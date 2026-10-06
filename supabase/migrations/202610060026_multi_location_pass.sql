-- ============================================================================
-- Un mismo QR para varias sedes de la empresa
--
-- Antes: la visita tenía una sola sede (visits.location_id) y la caseta no la
-- comparaba con nada; cualquier guardia de la empresa aceptaba cualquier pase y
-- la entrada quedaba registrada en la sede de la invitación aunque la persona
-- entrara por otra.
--
-- Ahora:
--   * visits.all_locations (por omisión true): el pase vale en todas las sedes.
--     Las visitas existentes quedan en true, que es como ya funcionaban.
--   * visit_access_locations: si all_locations = false, las sedes donde vale.
--     La sede principal (location_id) siempre vale.
--   * organization_members.default_location_id: la caseta habitual del guardia.
--     En su dispositivo puede cambiarla.
--   * record_access_decision recibe la sede donde está el guardia, rechaza el
--     pase si no vale ahí y registra la entrada en la sede real.
-- ============================================================================

alter table public.visits
  add column if not exists all_locations boolean not null default true;

create table if not exists public.visit_access_locations (
  visit_id uuid not null references public.visits(id) on delete cascade,
  location_id uuid not null references public.locations(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (visit_id, location_id)
);

create index if not exists visit_access_locations_location_idx
  on public.visit_access_locations (location_id);

-- Visita y sede deben ser de la misma empresa que la fila.
create or replace function public.visit_access_locations_same_org()
returns trigger
language plpgsql
security definer
set search_path = ''
as $fn$
begin
  if not exists (
       select 1 from public.visits v
       where v.id = new.visit_id and v.organization_id = new.organization_id)
     or not exists (
       select 1 from public.locations l
       where l.id = new.location_id and l.organization_id = new.organization_id) then
    raise exception 'La sede no pertenece a la empresa de la visita';
  end if;
  return new;
end $fn$;

revoke all on function public.visit_access_locations_same_org() from public, anon, authenticated;

drop trigger if exists visit_access_locations_same_org on public.visit_access_locations;
create trigger visit_access_locations_same_org
  before insert or update on public.visit_access_locations
  for each row execute function public.visit_access_locations_same_org();

alter table public.visit_access_locations enable row level security;

drop policy if exists visit_access_locations_select on public.visit_access_locations;
create policy visit_access_locations_select on public.visit_access_locations
  for select using (
    exists (
      select 1 from public.visits v
      where v.id = visit_access_locations.visit_id
        and public.can_access_visit(v)
    )
  );

-- Mismo alcance que las invitaciones: administración o el anfitrión de la visita.
drop policy if exists visit_access_locations_write on public.visit_access_locations;
create policy visit_access_locations_write on public.visit_access_locations
  for all
  using (
    public.has_role(organization_id, array['superadmin','admin']::public.member_role[])
    or exists (
      select 1 from public.visits v
      where v.id = visit_access_locations.visit_id
        and v.host_id = auth.uid()
        and v.organization_id = visit_access_locations.organization_id
    )
  )
  with check (
    public.has_role(organization_id, array['superadmin','admin']::public.member_role[])
    or exists (
      select 1 from public.visits v
      where v.id = visit_access_locations.visit_id
        and v.host_id = auth.uid()
        and v.organization_id = visit_access_locations.organization_id
    )
  );

grant select, insert, delete on public.visit_access_locations to authenticated;

-- ---------------------------------------------------------------------------
-- Caseta habitual de cada integrante (pensada para guardias).
-- ---------------------------------------------------------------------------
alter table public.organization_members
  add column if not exists default_location_id uuid
    references public.locations(id) on delete set null;

create or replace function public.member_location_same_org()
returns trigger
language plpgsql
security definer
set search_path = ''
as $fn$
begin
  if new.default_location_id is not null and not exists (
    select 1 from public.locations l
    where l.id = new.default_location_id and l.organization_id = new.organization_id
  ) then
    raise exception 'La sede no pertenece a la empresa';
  end if;
  return new;
end $fn$;

revoke all on function public.member_location_same_org() from public, anon, authenticated;

drop trigger if exists member_location_same_org on public.organization_members;
create trigger member_location_same_org
  before insert or update of default_location_id on public.organization_members
  for each row execute function public.member_location_same_org();

-- ---------------------------------------------------------------------------
-- ¿El pase de esta visita vale en esta sede?
-- ---------------------------------------------------------------------------
create or replace function public.visit_valid_at_location(p_visit public.visits, p_location uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $fn$
  select p_visit.all_locations
    or p_location = p_visit.location_id
    or exists (
      select 1 from public.visit_access_locations a
      where a.visit_id = p_visit.id and a.location_id = p_location
    )
$fn$;

revoke all on function public.visit_valid_at_location(public.visits, uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Decisión de acceso con la sede de la caseta.
-- p_location_id es opcional: sin él se comporta como antes (sede de la visita),
-- así el código que aún no lo envía sigue funcionando.
-- ---------------------------------------------------------------------------
drop function if exists public.record_access_decision(uuid, text, text, boolean);

create function public.record_access_decision(
  p_visit_id uuid,
  p_decision text,
  p_reason text default null,
  p_allow_outside_window boolean default false,
  p_location_id uuid default null)
returns public.visits language plpgsql security definer set search_path = '' as $fn$
declare
  v public.visits;
  allowed boolean;
  early_minutes integer;
  late_minutes integer;
  window_end timestamptz;
  event_location uuid;
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
    if p_location_id is not null and not public.visit_valid_at_location(v, p_location_id) then
      raise exception 'Este pase no es válido en esta sede';
    end if;
    if not p_allow_outside_window
       and now() not between v.starts_at - make_interval(mins => early_minutes)
                         and window_end then
      raise exception 'Fuera de la ventana autorizada';
    end if;
    update public.visits set status = 'checked_in', checked_in_at = now() where id = v.id returning * into v;
    insert into public.access_events (organization_id, visit_id, location_id, actor_id, event_type, metadata)
    values (v.organization_id, v.id, event_location, auth.uid(), 'check_in',
            jsonb_build_object('outside_window', p_allow_outside_window));
    insert into public.audit_logs (organization_id, actor_id, visit_id, event_type, metadata)
    values (v.organization_id, auth.uid(), v.id, 'entry_approved',
            jsonb_build_object('location_id', event_location));

  elsif p_decision = 'check_out' then
    if v.status = 'checked_out' then return v; end if;
    if v.status <> 'checked_in' then raise exception 'La entrada no está registrada'; end if;
    update public.visits set status = 'checked_out', checked_out_at = now() where id = v.id returning * into v;
    update public.qr_tokens set revoked_at = now() where visit_id = v.id and revoked_at is null;
    insert into public.access_events (organization_id, visit_id, location_id, actor_id, event_type)
    values (v.organization_id, v.id, event_location, auth.uid(), 'check_out');
    insert into public.audit_logs (organization_id, actor_id, visit_id, event_type, metadata)
    values (v.organization_id, auth.uid(), v.id, 'check_out',
            jsonb_build_object('location_id', event_location));

  elsif p_decision = 'deny' then
    if nullif(trim(coalesce(p_reason, '')), '') is null then raise exception 'El motivo es obligatorio'; end if;
    if v.status in ('checked_out', 'cancelled') then raise exception 'La visita ya fue cerrada'; end if;
    update public.visits set status = 'denied', denied_at = now(), denial_reason = p_reason
      where id = v.id returning * into v;
    update public.qr_tokens set revoked_at = now() where visit_id = v.id and revoked_at is null;
    insert into public.access_events (organization_id, visit_id, location_id, actor_id, event_type, reason)
    values (v.organization_id, v.id, event_location, auth.uid(), 'denied', p_reason);
    insert into public.audit_logs (organization_id, actor_id, visit_id, event_type, metadata)
    values (v.organization_id, auth.uid(), v.id, 'entry_denied',
            jsonb_build_object('reason', p_reason, 'location_id', event_location));

  else
    raise exception 'Decisión inválida';
  end if;
  return v;
end $fn$;

revoke all on function public.record_access_decision(uuid, text, text, boolean, uuid) from public, anon;
grant execute on function public.record_access_decision(uuid, text, text, boolean, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- La caseta recibe en un solo viaje dónde vale el pase, si el visitante
-- declaró que no trae vehículo y qué documentos hay de verdad. Antes cualquier
-- foto (incluida la de placas) se mostraba como «identificación capturada».
-- ---------------------------------------------------------------------------
drop function if exists public.resolve_qr_token(text);
create function public.resolve_qr_token(p_token text)
returns table(
  visit_id uuid, organization_id uuid, location_id uuid, location_name text,
  visitor_name text, visitor_company text, visitor_phone text, host_name text, host_email text,
  purpose text, vehicle_plate text, vehicle_declined boolean, visitor_notes text, access_requirements text,
  starts_at timestamptz, ends_at timestamptz, pass_valid_days integer, checked_in_at timestamptz,
  visit_status public.visit_status, token_state text, document_captured boolean,
  identity_captured boolean, vehicle_photos_captured boolean, attachments_captured boolean,
  all_locations boolean, access_location_ids uuid[], access_location_names text[]
)
language plpgsql security definer set search_path = '' as $fn$
declare
  hashed text := public.token_hash(p_token);
  org uuid;
begin
  select q.organization_id into org from public.qr_tokens q where q.token_hash = hashed;
  if org is null then return; end if;

  if not exists (
    select 1 from public.organization_members m
    where m.organization_id = org and m.profile_id = auth.uid()
      and m.active and m.role in ('superadmin', 'admin', 'guard')
  ) then
    raise exception 'Acceso denegado' using errcode = '42501';
  end if;

  insert into public.audit_logs (organization_id, visit_id, actor_id, event_type, metadata)
  select q.organization_id, q.visit_id, auth.uid(), 'qr_scanned',
    jsonb_build_object('result', case
      when q.revoked_at is not null then 'revoked'
      when q.expires_at < now() then 'expired'
      else 'resolved' end)
  from public.qr_tokens q where q.token_hash = hashed;

  return query
  select v.id, v.organization_id, v.location_id, l.name,
    coalesce(x.full_name, 'Visitante'), coalesce(v.visitor_company, x.company, ''),
    coalesce(x.phone, ''), h.full_name, coalesce(h.email, ''),
    v.purpose, coalesce(v.vehicle_plate, ''), v.vehicle_declined, coalesce(v.visitor_notes, ''),
    coalesce(v.access_requirements, ''),
    v.starts_at, v.ends_at, coalesce(v.pass_valid_days, 1), v.checked_in_at, v.status,
    case when q.revoked_at is not null then 'revoked'
      when v.status = 'cancelled' then 'cancelled'
      when v.status = 'checked_out' then 'used'
      when q.expires_at < now() then 'expired'
      when now() < q.valid_from then 'early'
      else 'valid' end,
    exists (select 1 from public.visitor_documents d
            where d.visit_id = v.id and d.deleted_at is null),
    exists (select 1 from public.visitor_documents d
            where d.visit_id = v.id and d.deleted_at is null
              and d.document_type in ('identity_front', 'identity_back', 'manual_capture')),
    exists (select 1 from public.visitor_documents d
            where d.visit_id = v.id and d.deleted_at is null
              and d.document_type = 'vehicle_plate'),
    exists (select 1 from public.visitor_documents d
            where d.visit_id = v.id and d.deleted_at is null
              and d.document_type = 'attachment'),
    v.all_locations,
    coalesce((select array_agg(a.location_id order by al.name)
              from public.visit_access_locations a
              join public.locations al on al.id = a.location_id
              where a.visit_id = v.id), array[]::uuid[]),
    coalesce((select array_agg(al.name order by al.name)
              from public.visit_access_locations a
              join public.locations al on al.id = a.location_id
              where a.visit_id = v.id), array[]::text[])
  from public.qr_tokens q
  join public.visits v on v.id = q.visit_id
  join public.locations l on l.id = v.location_id
  left join public.visitors x on x.id = v.visitor_id
  join public.profiles h on h.id = v.host_id
  where q.token_hash = hashed
  limit 1;
end $fn$;

revoke all on function public.resolve_qr_token(text) from public;
grant execute on function public.resolve_qr_token(text) to authenticated;
