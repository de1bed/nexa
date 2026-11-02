-- El guardia autoriza entrada, salida y rechazo por record_access_decision.
-- Desde las casetas, esa función también escribe check_in_booth_id y
-- check_out_booth_id. El disparador solo ignoraba status, horarios, rechazo
-- y updated_at, así que cualquier caseta hacía fallar el UPDATE con
-- 'Actualización no permitida para guardia'. La administración no pasa por
-- este bloque y por eso sí podía registrar el acceso.
--
-- Se ignoran únicamente esas dos columnas de caseta. location_id, notas,
-- visitante y el resto siguen bloqueados para el rol guard.

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
      (new.status = 'checked_out' and old.status = 'checked_in') or
      (new.status = 'denied' and old.status in ('invited','pre_registered','approved','checked_in'))
    ) then return new; end if;
    raise exception 'Actualización no permitida para guardia';
  end if;

  raise exception 'Actualización no autorizada';
end $fn$;

-- CREATE OR REPLACE vuelve a dejar la función invocable por la API.
-- El disparador no necesita EXECUTE: el privilegio se revisó al crearlo.
revoke all on function public.enforce_visit_update_permissions() from public, anon, authenticated;
