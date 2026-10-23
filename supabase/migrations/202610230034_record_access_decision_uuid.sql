-- Admin checkout from "Personas dentro" calls record_access_decision without a
-- booth. The sole-booth fallback used min(b.id), but PostgreSQL has no min(uuid),
-- so the whole function failed and the visitor stayed checked in.
-- Guard checkout already sends p_booth_id and never hit this branch.

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
    update public.qr_tokens set revoked_at = now() where visit_id = v.id and revoked_at is null;
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
