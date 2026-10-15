-- ============================================================================
-- Casetas dentro de una sede
--
-- Una ubicación (sede) puede tener varias casetas: norte, proveedores,
-- recepción. La invitación sigue apuntando a la sede. La entrada y la salida
-- quedan registradas en la caseta que las operó, para que una auditoría pueda
-- decir por dónde pasó cada persona.
--
-- Cada sede existente recibe una caseta «Caseta principal» para no dejar al
-- guardia sin punto de registro.
-- ============================================================================

create table if not exists public.booths (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  location_id uuid not null references public.locations(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 2 and 80),
  notes text not null default '' check (char_length(notes) <= 400),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (location_id, name)
);

create index if not exists booths_org_location_idx
  on public.booths (organization_id, location_id);

drop trigger if exists set_updated_at on public.booths;
create trigger set_updated_at before update on public.booths
  for each row execute function public.set_updated_at();

create or replace function public.booths_same_org()
returns trigger
language plpgsql
security definer
set search_path = ''
as $fn$
begin
  if not exists (
    select 1 from public.locations l
    where l.id = new.location_id and l.organization_id = new.organization_id
  ) then
    raise exception 'La sede no pertenece a la empresa';
  end if;
  return new;
end $fn$;

revoke all on function public.booths_same_org() from public, anon, authenticated;

drop trigger if exists booths_same_org on public.booths;
create trigger booths_same_org
  before insert or update on public.booths
  for each row execute function public.booths_same_org();

alter table public.booths enable row level security;

drop policy if exists booths_select on public.booths;
create policy booths_select on public.booths
  for select using (public.is_member(organization_id));

drop policy if exists booths_admin on public.booths;
create policy booths_admin on public.booths
  for all
  using (public.has_role(organization_id, array['superadmin','admin']::public.member_role[]))
  with check (public.has_role(organization_id, array['superadmin','admin']::public.member_role[]));

grant select, insert, update, delete on public.booths to authenticated;

insert into public.booths (organization_id, location_id, name)
select organization_id, id, 'Caseta principal'
from public.locations
on conflict (location_id, name) do nothing;

alter table public.visits
  add column if not exists check_in_booth_id uuid references public.booths(id) on delete set null,
  add column if not exists check_out_booth_id uuid references public.booths(id) on delete set null;

create index if not exists visits_check_in_booth_idx
  on public.visits (check_in_booth_id)
  where check_in_booth_id is not null;

alter table public.access_events
  add column if not exists booth_id uuid references public.booths(id) on delete set null;

alter table public.organization_members
  add column if not exists default_booth_id uuid references public.booths(id) on delete set null;

create or replace function public.member_location_same_org()
returns trigger
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  booth_location uuid;
begin
  if new.default_location_id is not null and not exists (
    select 1 from public.locations l
    where l.id = new.default_location_id and l.organization_id = new.organization_id
  ) then
    raise exception 'La sede no pertenece a la empresa';
  end if;

  if new.default_booth_id is not null then
    select b.location_id into booth_location
    from public.booths b
    where b.id = new.default_booth_id and b.organization_id = new.organization_id;
    if booth_location is null then
      raise exception 'La caseta no pertenece a la empresa';
    end if;
    if new.default_location_id is not null and new.default_location_id <> booth_location then
      raise exception 'La caseta no pertenece a la sede asignada';
    end if;
  end if;
  return new;
end $fn$;

revoke all on function public.member_location_same_org() from public, anon, authenticated;

drop trigger if exists member_booth_same_org on public.organization_members;
create trigger member_booth_same_org
  before insert or update of default_booth_id on public.organization_members
  for each row execute function public.member_location_same_org();

-- ---------------------------------------------------------------------------
-- La decisión de acceso guarda la caseta que la registró.
-- p_booth_id es opcional: sin él se comporta como antes.
-- ---------------------------------------------------------------------------
drop function if exists public.record_access_decision(uuid, text, text, boolean, uuid);

create function public.record_access_decision(
  p_visit_id uuid,
  p_decision text,
  p_reason text default null,
  p_allow_outside_window boolean default false,
  p_location_id uuid default null,
  p_booth_id uuid default null)
returns public.visits language plpgsql security definer set search_path = '' as $fn$
declare
  v public.visits;
  allowed boolean;
  early_minutes integer;
  late_minutes integer;
  window_end timestamptz;
  event_location uuid;
  booth_location uuid;
begin
  select * into v from public.visits where id = p_visit_id for update;
  if v.id is null then raise exception 'Visita no disponible'; end if;

  select true into allowed from public.organization_members
  where profile_id = auth.uid() and organization_id = v.organization_id
    and active and role in ('superadmin', 'admin', 'guard')
  limit 1;
  if allowed is not true then raise exception 'Acceso denegado' using errcode = '42501'; end if;

  if p_location_id is not null and not exists (
    select 1 from public.locations l
    where l.id = p_location_id and l.organization_id = v.organization_id
  ) then
    raise exception 'La sede no pertenece a la empresa';
  end if;

  event_location := coalesce(p_location_id, v.location_id);

  if p_booth_id is not null then
    select b.location_id into booth_location
    from public.booths b
    where b.id = p_booth_id
      and b.organization_id = v.organization_id
      and b.active;
    if booth_location is null then
      raise exception 'La caseta no está disponible';
    end if;
    if p_location_id is not null and booth_location <> p_location_id then
      raise exception 'La caseta no pertenece a esa sede';
    end if;
    event_location := booth_location;
  end if;

  select coalesce(s.early_entry_minutes, 15), coalesce(s.late_entry_minutes, 30)
    into early_minutes, late_minutes
  from public.organization_settings s where s.organization_id = v.organization_id;
  early_minutes := coalesce(early_minutes, 15);
  late_minutes := coalesce(late_minutes, 30);
  window_end := greatest(
    v.ends_at + make_interval(mins => late_minutes),
    v.starts_at + make_interval(days => coalesce(v.pass_valid_days, 1))
  );

  if p_decision = 'check_in' then
    if v.status = 'checked_in' then return v; end if;
    if v.status in ('checked_out', 'cancelled', 'denied', 'expired') then
      raise exception 'La visita ya fue cerrada o cancelada';
    end if;
    if (p_location_id is not null or p_booth_id is not null)
       and not public.visit_valid_at_location(v, event_location) then
      raise exception 'Este pase no es válido en esta sede';
    end if;
    if not p_allow_outside_window
       and now() not between v.starts_at - make_interval(mins => early_minutes)
                         and window_end then
      raise exception 'Fuera de la ventana autorizada';
    end if;
    update public.visits
      set status = 'checked_in',
          checked_in_at = now(),
          check_in_booth_id = p_booth_id
      where id = v.id returning * into v;
    insert into public.access_events (
      organization_id, visit_id, location_id, booth_id, actor_id, event_type, metadata
    ) values (
      v.organization_id, v.id, event_location, p_booth_id, auth.uid(), 'check_in',
      jsonb_build_object('outside_window', p_allow_outside_window, 'booth_id', p_booth_id)
    );
    insert into public.audit_logs (organization_id, actor_id, visit_id, event_type, metadata)
    values (v.organization_id, auth.uid(), v.id, 'entry_approved',
            jsonb_build_object('location_id', event_location, 'booth_id', p_booth_id));

  elsif p_decision = 'check_out' then
    if v.status = 'checked_out' then return v; end if;
    if v.status <> 'checked_in' then raise exception 'La entrada no está registrada'; end if;
    update public.visits
      set status = 'checked_out',
          checked_out_at = now(),
          check_out_booth_id = p_booth_id
      where id = v.id returning * into v;
    update public.qr_tokens set revoked_at = now() where visit_id = v.id and revoked_at is null;
    insert into public.access_events (
      organization_id, visit_id, location_id, booth_id, actor_id, event_type, metadata
    ) values (
      v.organization_id, v.id, event_location, p_booth_id, auth.uid(), 'check_out',
      jsonb_build_object('booth_id', p_booth_id)
    );
    insert into public.audit_logs (organization_id, actor_id, visit_id, event_type, metadata)
    values (v.organization_id, auth.uid(), v.id, 'check_out',
            jsonb_build_object('location_id', event_location, 'booth_id', p_booth_id));

  elsif p_decision = 'deny' then
    if nullif(trim(coalesce(p_reason, '')), '') is null then raise exception 'El motivo es obligatorio'; end if;
    if v.status in ('checked_out', 'cancelled') then raise exception 'La visita ya fue cerrada'; end if;
    update public.visits set status = 'denied', denied_at = now(), denial_reason = p_reason
      where id = v.id returning * into v;
    update public.qr_tokens set revoked_at = now() where visit_id = v.id and revoked_at is null;
    insert into public.access_events (
      organization_id, visit_id, location_id, booth_id, actor_id, event_type, reason, metadata
    ) values (
      v.organization_id, v.id, event_location, p_booth_id, auth.uid(), 'denied', p_reason,
      jsonb_build_object('booth_id', p_booth_id)
    );
    insert into public.audit_logs (organization_id, actor_id, visit_id, event_type, metadata)
    values (v.organization_id, auth.uid(), v.id, 'entry_denied',
            jsonb_build_object('reason', p_reason, 'location_id', event_location, 'booth_id', p_booth_id));

  else
    raise exception 'Decisión inválida';
  end if;
  return v;
end $fn$;

revoke all on function public.record_access_decision(uuid, text, text, boolean, uuid, uuid) from public, anon;
grant execute on function public.record_access_decision(uuid, text, text, boolean, uuid, uuid) to authenticated;
