-- Documentos de seguridad que el visitante recibe antes de llegar
-- (reglamento, equipo de protección, rutas de evacuación...).
--
-- La administración los sube en Configuración, junto al aviso de privacidad.
-- El visitante los abre desde su invitación y, al registrarse, acepta haberlos
-- leído. Queda constancia por visita: qué documento (con su título de ese
-- momento), cuándo lo abrió y cuándo lo aceptó.
--
-- Las escrituras van por la API con service role después de validar el rol o
-- el enlace de la invitación. El bucket es privado: se entrega con URL firmada.

create table if not exists public.organization_security_documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  title text not null check (char_length(title) between 2 and 120),
  storage_path text not null,
  mime_type text not null,
  size_bytes integer not null default 0,
  active boolean not null default true,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create index if not exists organization_security_documents_org_idx
  on public.organization_security_documents (organization_id) where active;

alter table public.organization_security_documents enable row level security;

drop policy if exists organization_security_documents_select on public.organization_security_documents;
create policy organization_security_documents_select on public.organization_security_documents
  for select using (public.is_member(organization_id));

revoke insert, update, delete on public.organization_security_documents from anon, authenticated;
grant select on public.organization_security_documents to authenticated;

create table if not exists public.visit_security_acceptances (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  visit_id uuid not null references public.visits(id) on delete cascade,
  document_id uuid references public.organization_security_documents(id) on delete set null,
  document_title text not null,
  opened_at timestamptz,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  unique (visit_id, document_id)
);

create index if not exists visit_security_acceptances_org_idx
  on public.visit_security_acceptances (organization_id);
create index if not exists visit_security_acceptances_document_idx
  on public.visit_security_acceptances (document_id);

alter table public.visit_security_acceptances enable row level security;

-- Lo ve quien ve la visita: administración, caseta y el anfitrión de la visita.
drop policy if exists visit_security_acceptances_select on public.visit_security_acceptances;
create policy visit_security_acceptances_select on public.visit_security_acceptances
  for select using (
    exists (
      select 1 from public.visits v
      where v.id = visit_security_acceptances.visit_id
        and public.can_access_visit(v)
    )
  );

revoke insert, update, delete on public.visit_security_acceptances from anon, authenticated;
grant select on public.visit_security_acceptances to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('security-documents', 'security-documents', false, 10485760,
        array['application/pdf', 'image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update
  set public = false,
      file_size_limit = 10485760,
      allowed_mime_types = array['application/pdf', 'image/png', 'image/jpeg', 'image/webp'];
