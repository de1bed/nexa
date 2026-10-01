-- Quien invita elige cuántos días dura el QR, de 1 a 365.
-- La caseta acepta la entrada durante ese plazo, no solo en la hora de la cita.

alter table public.visits
  add column if not exists pass_valid_days integer not null default 1;

alter table public.visits
  drop constraint if exists visits_pass_valid_days_range;

alter table public.visits
  add constraint visits_pass_valid_days_range
  check (pass_valid_days between 1 and 365);

create or replace function public.record_access_decision(
  p_visit_id uuid, p_decision text, p_reason text default null, p_allow_outside_window boolean default false)
returns public.visits language plpgsql security definer set search_path = '' as $fn$
declare
  v public.visits;
  allowed boolean;
  early_minutes integer;
  late_minutes integer;
  window_end timestamptz;
begin
  select * into v from public.visits where id = p_visit_id for update;
  if v.id is null then raise exception 'Visita no disponible'; end if;

  select true into allowed from public.organization_members
  where profile_id = auth.uid() and organization_id = v.organization_id
    and active and role in ('superadmin', 'admin', 'guard')
  limit 1;
  if allowed is not true then raise exception 'Acceso denegado' using errcode = '42501'; end if;

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
    if not p_allow_outside_window
       and now() not between v.starts_at - make_interval(mins => early_minutes)
                         and window_end then
      raise exception 'Fuera de la ventana autorizada';
    end if;
    update public.visits set status = 'checked_in', checked_in_at = now() where id = v.id returning * into v;
    insert into public.access_events (organization_id, visit_id, location_id, actor_id, event_type, metadata)
    values (v.organization_id, v.id, v.location_id, auth.uid(), 'check_in',
            jsonb_build_object('outside_window', p_allow_outside_window));
    insert into public.audit_logs (organization_id, actor_id, visit_id, event_type)
    values (v.organization_id, auth.uid(), v.id, 'entry_approved');

  elsif p_decision = 'check_out' then
    if v.status = 'checked_out' then return v; end if;
    if v.status <> 'checked_in' then raise exception 'La entrada no está registrada'; end if;
    update public.visits set status = 'checked_out', checked_out_at = now() where id = v.id returning * into v;
    update public.qr_tokens set revoked_at = now() where visit_id = v.id and revoked_at is null;
    insert into public.access_events (organization_id, visit_id, location_id, actor_id, event_type)
    values (v.organization_id, v.id, v.location_id, auth.uid(), 'check_out');
    insert into public.audit_logs (organization_id, actor_id, visit_id, event_type)
    values (v.organization_id, auth.uid(), v.id, 'check_out');

  elsif p_decision = 'deny' then
    if nullif(trim(coalesce(p_reason, '')), '') is null then raise exception 'El motivo es obligatorio'; end if;
    if v.status in ('checked_out', 'cancelled') then raise exception 'La visita ya fue cerrada'; end if;
    update public.visits set status = 'denied', denied_at = now(), denial_reason = p_reason
      where id = v.id returning * into v;
    update public.qr_tokens set revoked_at = now() where visit_id = v.id and revoked_at is null;
    insert into public.access_events (organization_id, visit_id, location_id, actor_id, event_type, reason)
    values (v.organization_id, v.id, v.location_id, auth.uid(), 'denied', p_reason);
    insert into public.audit_logs (organization_id, actor_id, visit_id, event_type, metadata)
    values (v.organization_id, auth.uid(), v.id, 'entry_denied', jsonb_build_object('reason', p_reason));

  else
    raise exception 'Decisión inválida';
  end if;
  return v;
end $fn$;

revoke all on function public.record_access_decision(uuid, text, text, boolean) from public, anon;
grant execute on function public.record_access_decision(uuid, text, text, boolean) to authenticated;
