-- Usuario de tableta por caseta y clave fija de empresa.
-- El guardia no puede leer ni la clave ni el usuario: solo el servidor los comprueba.

alter table public.organizations
  add column if not exists tablet_company_code text;

create unique index if not exists organizations_tablet_company_code_idx
  on public.organizations (tablet_company_code)
  where tablet_company_code is not null;

revoke select (tablet_company_code) on public.organizations from public, anon, authenticated;

create table if not exists public.station_users (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  username text not null check (char_length(username) between 3 and 32),
  booth_id uuid references public.booths(id) on delete set null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (organization_id, username)
);

create index if not exists station_users_org_idx
  on public.station_users (organization_id);

alter table public.station_users enable row level security;

revoke all on public.station_users from public, anon, authenticated;
