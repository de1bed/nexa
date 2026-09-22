-- Archivo de clientes, bitácora de la consola y visitas de hoy.
-- Archivar no borra visitas. La bitácora solo la lee la consola.

alter table public.organizations
  add column if not exists archived_at timestamptz;

grant select (archived_at) on public.organizations to authenticated;

create or replace function public.protect_organization_service()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if auth.role() = 'authenticated' then
    new.access_key := old.access_key;
    new.service_status := old.service_status;
    new.archived_at := old.archived_at;
  end if;
  return new;
end;
$$;

create table if not exists public.platform_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  actor_id uuid references public.profiles(id),
  event_type text not null check (
    event_type in (
      'company_created',
      'service_paused',
      'service_resumed',
      'key_rotated',
      'payment_recorded',
      'company_updated',
      'company_archived',
      'company_restored',
      'admin_invite_resent'
    )
  ),
  summary text not null,
  created_at timestamptz not null default now()
);

create index if not exists platform_events_created_idx
  on public.platform_events (created_at desc);

alter table public.platform_events enable row level security;
revoke all on public.platform_events from public, anon, authenticated;
grant select, insert, update, delete on public.platform_events to service_role;

insert into public.platform_events (organization_id, actor_id, event_type, summary, created_at)
select
  p.organization_id,
  p.recorded_by,
  'payment_recorded',
  'Registró un pago de ' || trim(to_char(p.amount, 'FM999999990.00')) || ' ' || p.currency
    || case when p.concept <> '' then ' · ' || p.concept else '' end,
  p.created_at
from public.platform_payments p
where not exists (
  select 1 from public.platform_events e
  where e.organization_id = p.organization_id
    and e.event_type = 'payment_recorded'
    and e.created_at = p.created_at
);

drop function if exists public.platform_visit_counts();

create function public.platform_visit_counts()
returns table(
  organization_id uuid,
  visits bigint,
  visits_this_month bigint,
  visits_today bigint,
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
    count(*) filter (
      where v.starts_at >= (
        date_trunc('day', timezone('America/Mexico_City', now()))
      ) at time zone 'America/Mexico_City'
    )::bigint,
    max(v.starts_at)
  from public.visits v
  group by v.organization_id;
$$;

revoke all on function public.platform_visit_counts() from public, anon, authenticated;
grant execute on function public.platform_visit_counts() to service_role;
