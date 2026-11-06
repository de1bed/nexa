-- La hora salía dos horas adelantada respecto a Tijuana.
--
-- Causa: las sedes que se dieron de alta con el valor por omisión anterior
-- quedaron en America/Mexico_City (UTC-6). Desde el 1 de noviembre Tijuana
-- está en UTC-8, así que cada entrada, salida y cita se pintaba +2 h.
-- La migración 0036 solo corrigió la empresa llamada exactamente 'Sohnen'.
--
-- 1. set_location_timezone: cambia la zona de una sede y reinterpreta la
--    hora escrita de las citas que todavía no suceden (9:00 sigue siendo
--    9:00, ahora en la zona nueva). Las entradas y salidas ya registradas
--    son instantes reales y no se tocan.
-- 2. Pasa a America/Tijuana toda sede que siga en America/Mexico_City, con
--    la misma reinterpretación que hizo la 0036 para Sohnen.
-- 3. El alta de empresa usa America/Tijuana por omisión.
--
-- ANTES DE APLICAR, revisa qué sedes cambian (ninguna debería operar de
-- verdad en la Ciudad de México):
--   select o.name, l.name, l.timezone from public.locations l
--   join public.organizations o on o.id = l.organization_id
--   where l.timezone = 'America/Mexico_City';

create or replace function public.shift_location_wall_times(
  p_location_id uuid,
  p_from text,
  p_to text,
  p_created_since timestamptz default null)
returns integer
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  shifted integer;
begin
  if p_from = p_to then return 0; end if;

  with moved as (
    update public.visits v
    set starts_at = (v.starts_at at time zone p_from) at time zone p_to,
        ends_at = (v.ends_at at time zone p_from) at time zone p_to
    where v.location_id = p_location_id
      and v.origin = 'host_invitation'
      and v.status in ('draft', 'invited', 'pre_registered', 'approved')
      and (p_created_since is null or v.created_at >= p_created_since)
    returning v.id
  ), invitations as (
    update public.visit_invitations i
    set expires_at = (i.expires_at at time zone p_from) at time zone p_to
    where i.visit_id in (select id from moved) and i.expires_at is not null
    returning i.id
  ), tokens as (
    update public.qr_tokens q
    set valid_from = (q.valid_from at time zone p_from) at time zone p_to,
        expires_at = (q.expires_at at time zone p_from) at time zone p_to
    where q.visit_id in (select id from moved) and q.revoked_at is null
    returning q.id
  )
  select count(*)::integer into shifted from moved;

  return coalesce(shifted, 0);
end $fn$;

revoke all on function public.shift_location_wall_times(uuid, text, text, timestamptz)
  from public, anon, authenticated;

-- La administración cambia la zona desde Ubicaciones.
create or replace function public.set_location_timezone(p_location_id uuid, p_timezone text)
returns public.locations
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  loc public.locations;
  zone text := nullif(trim(coalesce(p_timezone, '')), '');
begin
  select * into loc from public.locations where id = p_location_id for update;
  if loc.id is null then raise exception 'Ubicación no disponible'; end if;

  if not exists (
    select 1 from public.organization_members m
    where m.organization_id = loc.organization_id and m.profile_id = auth.uid()
      and m.active and m.role in ('superadmin', 'admin')
  ) then
    raise exception 'Acceso denegado' using errcode = '42501';
  end if;

  if zone is null or not exists (select 1 from pg_catalog.pg_timezone_names where name = zone) then
    raise exception 'Zona horaria no válida';
  end if;

  if loc.timezone = zone then return loc; end if;

  perform public.shift_location_wall_times(loc.id, loc.timezone, zone);
  update public.locations set timezone = zone where id = loc.id returning * into loc;
  return loc;
end $fn$;

revoke all on function public.set_location_timezone(uuid, text) from public, anon;
grant execute on function public.set_location_timezone(uuid, text) to authenticated;

-- Corrección de datos. El disparador de permisos solo deja pasar a
-- service_role; esta corrección corre como dueño de la migración.
alter table public.visits disable trigger enforce_visit_update_permissions;

do $$
declare
  loc record;
begin
  for loc in
    select id from public.locations where timezone = 'America/Mexico_City'
  loop
    -- Misma frontera que la 0036: desde ese cambio la hora escrita se guardó
    -- en la zona de la sede.
    perform public.shift_location_wall_times(
      loc.id, 'America/Mexico_City', 'America/Tijuana',
      timestamptz '2026-10-25 15:06:00+00');
    update public.locations set timezone = 'America/Tijuana' where id = loc.id;
  end loop;
end $$;

alter table public.visits enable trigger enforce_visit_update_permissions;

alter table public.locations alter column timezone set default 'America/Tijuana';
