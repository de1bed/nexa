create or replace function public.enforce_visit_update_permissions()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  role_name public.member_role;
  old_payload jsonb;
  new_payload jsonb;
begin
  if auth.role() = 'service_role' then return new; end if;

  select member.role into role_name
  from public.organization_members member
  where member.organization_id = old.organization_id
    and member.profile_id = auth.uid()
    and member.active
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
    old_payload := to_jsonb(old) - array['status','checked_in_at','checked_out_at','denied_at','denial_reason','updated_at'];
    new_payload := to_jsonb(new) - array['status','checked_in_at','checked_out_at','denied_at','denial_reason','updated_at'];
    if old_payload = new_payload and (
      (new.status = 'checked_in' and old.status in ('invited','pre_registered','approved')) or
      (new.status = 'checked_out' and old.status = 'checked_in') or
      (new.status = 'denied' and old.status in ('invited','pre_registered','approved'))
    ) then return new; end if;
    raise exception 'Actualización no permitida para guardia';
  end if;

  raise exception 'Actualización no autorizada';
end
$$;

create trigger enforce_visit_update_permissions
before update on public.visits
for each row execute function public.enforce_visit_update_permissions();

-- Un anfitrión solo crea invitaciones para visitas propias; administradores conservan alcance organizacional.
drop policy if exists invitations_staff on public.visit_invitations;
create policy invitations_staff on public.visit_invitations
for all
using (
  public.has_role(organization_id, array['superadmin','admin']::public.member_role[])
  or exists(select 1 from public.visits visit where visit.id = visit_id and visit.host_id = auth.uid() and visit.organization_id = organization_id)
)
with check (
  public.has_role(organization_id, array['superadmin','admin']::public.member_role[])
  or exists(select 1 from public.visits visit where visit.id = visit_id and visit.host_id = auth.uid() and visit.organization_id = organization_id)
);

-- La bitácora es append-only incluso para usuarios autenticados.
revoke update, delete on public.audit_logs from authenticated;
