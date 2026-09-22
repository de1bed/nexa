-- Cobros y ficha comercial. Solo los lee la consola de plataforma (service role).
-- Un administrador de empresa no tiene políticas para verlos.

create table if not exists public.platform_accounts (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  plan_name text not null default '',
  monthly_amount numeric(12, 2),
  currency text not null default 'MXN' check (currency in ('MXN', 'USD')),
  billing_email text,
  notes text not null default '',
  updated_at timestamptz not null default now()
);

create table if not exists public.platform_payments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  amount numeric(12, 2) not null check (amount > 0 and amount <= 100000000),
  currency text not null default 'MXN' check (currency in ('MXN', 'USD')),
  paid_on date not null default ((now() at time zone 'America/Mexico_City')::date),
  method text not null default 'transfer' check (method in ('transfer', 'cash', 'card', 'other')),
  reference text not null default '',
  concept text not null default '',
  recorded_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create index if not exists platform_payments_org_paid_idx
  on public.platform_payments (organization_id, paid_on desc);

alter table public.platform_accounts enable row level security;
alter table public.platform_payments enable row level security;

revoke all on public.platform_accounts from public, anon, authenticated;
revoke all on public.platform_payments from public, anon, authenticated;
grant select, insert, update, delete on public.platform_accounts to service_role;
grant select, insert, update, delete on public.platform_payments to service_role;

create or replace function public.platform_visit_counts()
returns table(
  organization_id uuid,
  visits bigint,
  visits_this_month bigint,
  last_visit timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    v.organization_id,
    count(*)::bigint,
    count(*) filter (
      where v.starts_at >= (
        date_trunc('month', timezone('America/Mexico_City', now()))
      ) at time zone 'America/Mexico_City'
    )::bigint,
    max(v.starts_at)
  from public.visits v
  group by v.organization_id;
$$;

revoke all on function public.platform_visit_counts() from public, anon, authenticated;
grant execute on function public.platform_visit_counts() to service_role;
