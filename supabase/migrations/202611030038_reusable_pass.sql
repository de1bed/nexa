-- Un pase de varias sedes, o de más de un día, se puede usar sin límite de
-- entradas mientras siga vigente (expires_at > now()). La salida no quema el
-- QR: la siguiente planta puede registrar otra entrada. El historial queda
-- en access_events.
--
-- Es reutilizable si all_locations, si tiene filas en visit_access_locations,
-- o si pass_valid_days > 1. Un pase de un solo día y una sola sede se cierra
-- al salir, como hasta ahora.
--
-- Para cambiar la regla (por ejemplo, un cupo de entradas) basta con editar
-- pass_is_reusable.

create or replace function public.pass_is_reusable(p_visit public.visits)
returns boolean
language sql
stable
security definer
set search_path = ''
as $fn$
  select coalesce(p_visit.all_locations, false)
    or coalesce(p_visit.pass_valid_days, 1) > 1
    or exists (
      select 1 from public.visit_access_locations a
      where a.visit_id = p_visit.id
    )
$fn$;

revoke all on function public.pass_is_reusable(public.visits) from public, anon, authenticated;

create or replace function public.record_access_decision(
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
  booth_count integer;
  booth_label text;
  actor_label text;
  reusable boolean;
  still_valid boolean;
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

  if p_booth_id is null then
    select count(*)::integer,
           case when count(*) = 1 then (array_agg(b.id))[1] else null end
      into booth_count, p_booth_id
    from public.booths b
    where b.organization_id = v.organization_id
      and b.location_id = event_location
      and b.active;
    if coalesce(booth_count, 0) > 1 and p_decision in ('check_in', 'deny') then
      raise exception 'Elige la caseta antes de registrar el acceso';
    end if;
  end if;

  if p_booth_id is not null then
    select b.location_id, b.name into booth_location, booth_label
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

  select coalesce(p.full_name, 'Sistema') into actor_label
  from public.profiles p where p.id = auth.uid();
  actor_label := coalesce(actor_label, 'Sistema');

  select coalesce(s.early_entry_minutes, 15), coalesce(s.late_entry_minutes, 30)
    into early_minutes, late_minutes
  from public.organization_settings s where s.organization_id = v.organization_id;
  early_minutes := coalesce(early_minutes, 15);
  late_minutes := coalesce(late_minutes, 30);
  window_end := greatest(
    v.ends_at + make_interval(mins => late_minutes),
    v.starts_at + make_interval(days => coalesce(v.pass_valid_days, 1))
  );

  reusable := public.pass_is_reusable(v);

  if p_decision = 'check_in' then
    if v.status = 'checked_in' then return v; end if;
    if v.status = 'checked_out' and not reusable then
      raise exception 'La visita ya fue cerrada o cancelada';
    end if;
    if v.status in ('cancelled', 'denied', 'expired') then
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
          checked_out_at = case when v.status = 'checked_out' then null else checked_out_at end,
          check_out_booth_id = case when v.status = 'checked_out' then null else check_out_booth_id end,
          check_in_booth_id = p_booth_id
      where id = v.id returning * into v;
    insert into public.access_events (
      organization_id, visit_id, location_id, booth_id, actor_id, event_type, metadata
    ) values (
      v.organization_id, v.id, event_location, p_booth_id, auth.uid(), 'check_in',
      jsonb_strip_nulls(jsonb_build_object(
        'outside_window', p_allow_outside_window,
        'booth_id', p_booth_id,
        'booth_name', booth_label,
        'actor_name', actor_label
      ))
    );
    insert into public.audit_logs (organization_id, actor_id, visit_id, event_type, metadata)
    values (v.organization_id, auth.uid(), v.id, 'entry_approved',
            jsonb_strip_nulls(jsonb_build_object(
              'location_id', event_location,
              'booth_id', p_booth_id,
              'booth_name', booth_label,
              'actor_name', actor_label
            )));

  elsif p_decision = 'check_out' then
    if v.status = 'checked_out' then return v; end if;
    if v.status <> 'checked_in' then raise exception 'La entrada no está registrada'; end if;
    update public.visits
      set status = 'checked_out',
          checked_out_at = now(),
          check_out_booth_id = p_booth_id
      where id = v.id returning * into v;
    select exists (
      select 1 from public.qr_tokens q
      where q.visit_id = v.id and q.revoked_at is null and q.expires_at > now()
    ) into still_valid;
    if not reusable or not coalesce(still_valid, false) then
      update public.qr_tokens set revoked_at = now()
      where visit_id = v.id and revoked_at is null;
    end if;
    insert into public.access_events (
      organization_id, visit_id, location_id, booth_id, actor_id, event_type, metadata
    ) values (
      v.organization_id, v.id, event_location, p_booth_id, auth.uid(), 'check_out',
      jsonb_strip_nulls(jsonb_build_object(
        'booth_id', p_booth_id,
        'booth_name', booth_label,
        'actor_name', actor_label
      ))
    );
    insert into public.audit_logs (organization_id, actor_id, visit_id, event_type, metadata)
    values (v.organization_id, auth.uid(), v.id, 'check_out',
            jsonb_strip_nulls(jsonb_build_object(
              'location_id', event_location,
              'booth_id', p_booth_id,
              'booth_name', booth_label,
              'actor_name', actor_label
            )));

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
      jsonb_strip_nulls(jsonb_build_object(
        'booth_id', p_booth_id,
        'booth_name', booth_label,
        'actor_name', actor_label
      ))
    );
    insert into public.audit_logs (organization_id, actor_id, visit_id, event_type, metadata)
    values (v.organization_id, auth.uid(), v.id, 'entry_denied',
            jsonb_strip_nulls(jsonb_build_object(
              'reason', p_reason,
              'location_id', event_location,
              'booth_id', p_booth_id,
              'booth_name', booth_label,
              'actor_name', actor_label
            )));

  else
    raise exception 'Decisión inválida';
  end if;
  return v;
end $fn$;

revoke all on function public.record_access_decision(uuid, text, text, boolean, uuid, uuid) from public, anon;
grant execute on function public.record_access_decision(uuid, text, text, boolean, uuid, uuid) to authenticated;

-- El guardia puede volver a dejar en checked_in un pase reutilizable que ya salió.
-- Las columnas de caseta siguen en la lista que se ignora.
create or replace function public.enforce_visit_update_permissions()
returns trigger
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  role_name public.member_role;
  old_payload jsonb;
  new_payload jsonb;
begin
  if auth.role() = 'service_role' then return new; end if;

  select member.role into role_name
  from public.organization_members member
  where member.organization_id = old.organization_id
    and member.profile_id = auth.uid() and member.active
  limit 1;

  if role_name in ('superadmin', 'admin') then return new; end if;

  if role_name = 'host' and old.host_id = auth.uid() then
    old_payload := to_jsonb(old) - array['status','cancelled_at','cancelled_by','updated_at'];
    new_payload := to_jsonb(new) - array['status','cancelled_at','cancelled_by','updated_at'];
    if old_payload = new_payload
       and new.status = 'cancelled'
       and old.status in ('draft','invited','pre_registered','approved')
       and new.cancelled_by = auth.uid()
       and new.cancelled_at is not null then
      return new;
    end if;
    raise exception 'Actualización no permitida para anfitrión';
  end if;

  if role_name = 'guard' then
    old_payload := to_jsonb(old) - array[
      'status','checked_in_at','checked_out_at','denied_at','denial_reason','updated_at',
      'check_in_booth_id','check_out_booth_id'
    ];
    new_payload := to_jsonb(new) - array[
      'status','checked_in_at','checked_out_at','denied_at','denial_reason','updated_at',
      'check_in_booth_id','check_out_booth_id'
    ];
    if old_payload = new_payload and (
      (new.status = 'checked_in' and old.status in ('invited','pre_registered','approved')) or
      (new.status = 'checked_in' and old.status = 'checked_out' and public.pass_is_reusable(old)) or
      (new.status = 'checked_out' and old.status = 'checked_in') or
      (new.status = 'denied' and old.status in ('invited','pre_registered','approved','checked_in'))
    ) then return new; end if;
    raise exception 'Actualización no permitida para guardia';
  end if;

  raise exception 'Actualización no autorizada';
end $fn$;

revoke all on function public.enforce_visit_update_permissions() from public, anon, authenticated;

-- Un pase reutilizable que ya salió sigue vigente. 'used' queda para el de un solo uso.
create or replace function public.resolve_qr_token(p_token text)
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
      when v.status = 'checked_out' and not public.pass_is_reusable(v) then 'used'
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

-- Un pase de varios días no vence al terminar la hora de la cita.
create or replace function public.expire_stale_visits()
returns integer language plpgsql security definer set search_path = '' as $fn$
declare affected integer;
begin
  update public.visits
  set status = 'expired'
  where status in ('invited', 'pre_registered', 'approved')
    and greatest(
      ends_at,
      starts_at + make_interval(days => coalesce(pass_valid_days, 1))
    ) < now() - interval '12 hours';
  get diagnostics affected = row_count;

  update public.qr_tokens q set revoked_at = now()
  from public.visits v
  where q.visit_id = v.id and v.status = 'expired' and q.revoked_at is null;

  return affected;
end $fn$;

revoke all on function public.expire_stale_visits() from public, anon, authenticated;
grant execute on function public.expire_stale_visits() to service_role;
