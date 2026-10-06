-- ============================================================================
-- QR de autorregistro por sede (visitas espontáneas)
--
-- La empresa imprime una hoja con su QR y un código de 4 dígitos. Quien llega
-- sin invitación escanea, escribe el código, elige a quién visita y completa el
-- mismo registro que una invitación normal. Al final recibe su QR de acceso.
--
--   * Un punto por sede (unique location_id).
--   * public_token va dentro del QR impreso; access_code va impreso debajo.
--     Ambos se guardan en claro porque la administración debe poder volver a
--     imprimir la hoja. No son secretos fuertes: prueban que la persona está
--     físicamente frente a la hoja.
--   * Regenerar el token invalida la hoja impresa; regenerar el código también
--     obliga a reimprimirla, pero el QR sigue igual.
--   * Un código de 4 dígitos tiene 10 000 combinaciones. El límite en memoria
--     de la API no sirve en serverless (cada instancia cuenta por su lado), así
--     que los intentos fallidos se cuentan aquí:
--       - por cliente (hash de IP): 5 fallos en 15 min -> bloqueo de 15 min.
--       - por punto: 50 fallos en 1 h -> bloqueo de 15 min para todos.
-- ============================================================================

create table if not exists public.walkin_points (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  location_id uuid not null unique references public.locations(id) on delete cascade,
  public_token text not null unique check (char_length(public_token) between 16 and 128),
  access_code text not null check (access_code ~ '^[0-9]{4}$'),
  active boolean not null default true,
  failures_in_window integer not null default 0,
  failures_window_started_at timestamptz,
  locked_until timestamptz,
  token_rotated_at timestamptz not null default now(),
  code_rotated_at timestamptz not null default now(),
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists walkin_points_org_idx on public.walkin_points (organization_id);

drop trigger if exists set_updated_at on public.walkin_points;
create trigger set_updated_at before update on public.walkin_points
  for each row execute function public.set_updated_at();

create or replace function public.walkin_points_same_org()
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

revoke all on function public.walkin_points_same_org() from public, anon, authenticated;

drop trigger if exists walkin_points_same_org on public.walkin_points;
create trigger walkin_points_same_org
  before insert or update on public.walkin_points
  for each row execute function public.walkin_points_same_org();

alter table public.walkin_points enable row level security;

drop policy if exists walkin_points_admin on public.walkin_points;
create policy walkin_points_admin on public.walkin_points
  for all
  using (public.has_role(organization_id, array['superadmin','admin']::public.member_role[]))
  with check (public.has_role(organization_id, array['superadmin','admin']::public.member_role[]));

grant select, insert, update, delete on public.walkin_points to authenticated;

create table if not exists public.walkin_attempts (
  point_id uuid not null references public.walkin_points(id) on delete cascade,
  client_hash text not null,
  failures integer not null default 0,
  window_started_at timestamptz not null default now(),
  locked_until timestamptz,
  primary key (point_id, client_hash)
);

alter table public.walkin_attempts enable row level security;
revoke all on public.walkin_attempts from public, anon, authenticated;
grant select, insert, update, delete on public.walkin_attempts to service_role;

-- ---------------------------------------------------------------------------
-- Verifica el código de un punto y lleva la cuenta de intentos.
-- Solo la llama la API pública con service role.
--   state: ok | invalid | wrong_code | locked
-- ---------------------------------------------------------------------------
create or replace function public.walkin_verify(p_token text, p_code text, p_client text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  pt public.walkin_points%rowtype;
  attempt public.walkin_attempts%rowtype;
  client_limit constant integer := 5;
  point_limit constant integer := 50;
  lock_span constant interval := interval '15 minutes';
begin
  select p.* into pt
  from public.walkin_points p
  join public.locations l on l.id = p.location_id
  join public.organizations o on o.id = p.organization_id
  where p.public_token = p_token
    and p.active
    and l.active
    and o.service_status = 'active'
    and o.archived_at is null
  for update of p;

  if pt.id is null then
    return jsonb_build_object('state', 'invalid');
  end if;

  select * into attempt
  from public.walkin_attempts
  where point_id = pt.id and client_hash = p_client
  for update;

  if (attempt.locked_until is not null and attempt.locked_until > now())
     or (pt.locked_until is not null and pt.locked_until > now()) then
    return jsonb_build_object(
      'state', 'locked',
      'retryAfter', ceil(extract(epoch from (
        greatest(coalesce(attempt.locked_until, now()), coalesce(pt.locked_until, now())) - now()
      )))::integer);
  end if;

  if p_code is not null and p_code = pt.access_code then
    if attempt.point_id is not null then
      update public.walkin_attempts
      set failures = 0, locked_until = null, window_started_at = now()
      where point_id = pt.id and client_hash = p_client;
    end if;
    return jsonb_build_object(
      'state', 'ok',
      'pointId', pt.id,
      'organizationId', pt.organization_id,
      'locationId', pt.location_id);
  end if;

  -- Fallo por cliente.
  if attempt.point_id is null then
    insert into public.walkin_attempts (point_id, client_hash, failures, window_started_at)
    values (pt.id, p_client, 1, now())
    returning * into attempt;
  elsif attempt.window_started_at < now() - lock_span then
    update public.walkin_attempts
    set failures = 1, window_started_at = now(), locked_until = null
    where point_id = pt.id and client_hash = p_client
    returning * into attempt;
  else
    update public.walkin_attempts
    set failures = failures + 1,
        locked_until = case when failures + 1 >= client_limit then now() + lock_span else null end
    where point_id = pt.id and client_hash = p_client
    returning * into attempt;
  end if;

  -- Fallo por punto.
  if pt.failures_window_started_at is null
     or pt.failures_window_started_at < now() - interval '1 hour' then
    update public.walkin_points
    set failures_in_window = 1, failures_window_started_at = now()
    where id = pt.id;
  else
    update public.walkin_points
    set failures_in_window = failures_in_window + 1,
        locked_until = case when failures_in_window + 1 >= point_limit then now() + lock_span else locked_until end
    where id = pt.id;
  end if;

  if attempt.locked_until is not null then
    insert into public.audit_logs (organization_id, event_type, metadata)
    values (pt.organization_id, 'walkin_locked', jsonb_build_object('point_id', pt.id));
    return jsonb_build_object('state', 'locked',
      'retryAfter', ceil(extract(epoch from (attempt.locked_until - now())))::integer);
  end if;

  return jsonb_build_object('state', 'wrong_code',
    'attemptsLeft', greatest(client_limit - attempt.failures, 0));
end $fn$;

revoke all on function public.walkin_verify(text, text, text) from public, anon, authenticated;
grant execute on function public.walkin_verify(text, text, text) to service_role;

-- ---------------------------------------------------------------------------
-- Logo de la empresa para la hoja imprimible (y, después, para el pase).
-- Lectura pública; la escritura la hace la API con service role tras validar
-- que quien sube es administración. Sin SVG: puede llevar scripts.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('organization-logos', 'organization-logos', true, 2097152,
        array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update
  set public = true,
      file_size_limit = 2097152,
      allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp'];
