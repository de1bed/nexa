-- Código de tableta para guardias. No es un correo: el hash identifica
-- al guardia dentro de su empresa y la entrada queda a su nombre.

create table if not exists public.guard_access_codes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  code_hash text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (organization_id, profile_id),
  unique (code_hash)
);

create index if not exists guard_access_codes_org_idx
  on public.guard_access_codes (organization_id);

alter table public.guard_access_codes enable row level security;

revoke all on public.guard_access_codes from public, anon, authenticated;
