-- ============================================================================
-- Anexos con título, texto y foto, y requisitos propios de cada empresa
--
-- organization_requirements: catálogo que da de alta la administración. Cada
--   requisito trae título y descripción ya escritos, y dice qué se le pide al
--   visitante (foto, texto o ambos), si es obligatorio y si se aplica por
--   omisión a las invitaciones nuevas.
--
-- visit_attachments: lo que se le pide (y lo que entregó) en UNA visita.
--   source = 'requested' -> copia de un requisito al crear la invitación. Es
--                           copia para que editar el catálogo no cambie las
--                           invitaciones ya enviadas.
--   source = 'visitor'   -> anexo libre que agrega el visitante (título,
--                           texto y foto, los tres opcionales).
--
-- visitor_documents.attachment_id liga cada foto con su anexo.
-- La política «Anexos» (off / optional / required) de visitor_flow no cambia:
-- sigue gobernando los anexos libres.
-- ============================================================================

create table if not exists public.organization_requirements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  title text not null check (char_length(trim(title)) between 1 and 120),
  description text not null default '' check (char_length(description) <= 1000),
  ask_photo boolean not null default true,
  ask_text boolean not null default false,
  required boolean not null default false,
  apply_by_default boolean not null default true,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint organization_requirements_asks_something check (ask_photo or ask_text)
);

create index if not exists organization_requirements_org_idx
  on public.organization_requirements (organization_id, sort_order)
  where active;

drop trigger if exists set_updated_at on public.organization_requirements;
create trigger set_updated_at before update on public.organization_requirements
  for each row execute function public.set_updated_at();

alter table public.organization_requirements enable row level security;

drop policy if exists organization_requirements_select on public.organization_requirements;
create policy organization_requirements_select on public.organization_requirements
  for select using (public.is_member(organization_id));

drop policy if exists organization_requirements_admin on public.organization_requirements;
create policy organization_requirements_admin on public.organization_requirements
  for all
  using (public.has_role(organization_id, array['superadmin','admin']::public.member_role[]))
  with check (public.has_role(organization_id, array['superadmin','admin']::public.member_role[]));

grant select, insert, update, delete on public.organization_requirements to authenticated;

create table if not exists public.visit_attachments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  visit_id uuid not null references public.visits(id) on delete cascade,
  requirement_id uuid references public.organization_requirements(id) on delete set null,
  source text not null check (source in ('requested', 'visitor')),
  title text not null default '' check (char_length(title) <= 120),
  description text not null default '' check (char_length(description) <= 1000),
  ask_photo boolean not null default true,
  ask_text boolean not null default true,
  required boolean not null default false,
  response_text text check (response_text is null or char_length(response_text) <= 2000),
  sort_order integer not null default 0,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists visit_attachments_visit_idx
  on public.visit_attachments (visit_id, sort_order);

drop trigger if exists set_updated_at on public.visit_attachments;
create trigger set_updated_at before update on public.visit_attachments
  for each row execute function public.set_updated_at();

create or replace function public.visit_attachments_same_org()
returns trigger
language plpgsql
security definer
set search_path = ''
as $fn$
begin
  if not exists (
    select 1 from public.visits v
    where v.id = new.visit_id and v.organization_id = new.organization_id
  ) then
    raise exception 'El anexo no pertenece a la empresa de la visita';
  end if;
  if new.requirement_id is not null and not exists (
    select 1 from public.organization_requirements r
    where r.id = new.requirement_id and r.organization_id = new.organization_id
  ) then
    raise exception 'El requisito no pertenece a la empresa';
  end if;
  return new;
end $fn$;

revoke all on function public.visit_attachments_same_org() from public, anon, authenticated;

drop trigger if exists visit_attachments_same_org on public.visit_attachments;
create trigger visit_attachments_same_org
  before insert or update on public.visit_attachments
  for each row execute function public.visit_attachments_same_org();

alter table public.visit_attachments enable row level security;

-- Lo ve quien ve la visita: administración, caseta y el anfitrión de la visita.
drop policy if exists visit_attachments_select on public.visit_attachments;
create policy visit_attachments_select on public.visit_attachments
  for select using (
    exists (
      select 1 from public.visits v
      where v.id = visit_attachments.visit_id
        and public.can_access_visit(v)
    )
  );

-- Al invitar, administración o el anfitrión de la visita copian los requisitos.
-- Lo que entrega el visitante entra por la API pública con service role.
drop policy if exists visit_attachments_staff_write on public.visit_attachments;
create policy visit_attachments_staff_write on public.visit_attachments
  for all
  using (
    public.has_role(organization_id, array['superadmin','admin']::public.member_role[])
    or exists (
      select 1 from public.visits v
      where v.id = visit_attachments.visit_id
        and v.host_id = auth.uid()
        and v.organization_id = visit_attachments.organization_id
    )
  )
  with check (
    public.has_role(organization_id, array['superadmin','admin']::public.member_role[])
    or exists (
      select 1 from public.visits v
      where v.id = visit_attachments.visit_id
        and v.host_id = auth.uid()
        and v.organization_id = visit_attachments.organization_id
    )
  );

grant select, insert, update, delete on public.visit_attachments to authenticated;

alter table public.visitor_documents
  add column if not exists attachment_id uuid
    references public.visit_attachments(id) on delete set null;

create index if not exists visitor_documents_attachment_idx
  on public.visitor_documents (attachment_id)
  where attachment_id is not null;
