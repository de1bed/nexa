-- Sohnen opera en Tijuana y San Diego. Las sedes se crearon con el
-- valor por omisión de la consola (America/Mexico_City). Desde el cambio
-- de horarios de la invitación, la hora capturada se guardó en esa zona
-- mientras la caseta la pintaba en America/Tijuana: una hora de diferencia
-- en octubre (y dos después del cambio de horario del Pacífico).
--
-- Se reinterpreta la hora de pared de las invitaciones creadas a partir de
-- ese cambio como hora de Tijuana, y la sede queda en America/Tijuana.
-- Los pases de llegada inmediata (walk-in / caseta) no se tocan: su inicio
-- es el instante real, no una hora escrita.
-- El trigger de permisos solo deja pasar a service_role; esta corrección
-- corre como dueño de la migración.

alter table public.visits disable trigger enforce_visit_update_permissions;

update public.visits v
set
  starts_at = (v.starts_at at time zone 'America/Mexico_City') at time zone 'America/Tijuana',
  ends_at = (v.ends_at at time zone 'America/Mexico_City') at time zone 'America/Tijuana'
from public.organizations o
where v.organization_id = o.id
  and o.name = 'Sohnen'
  and v.origin = 'host_invitation'
  and v.created_at >= timestamptz '2026-10-25 15:06:00+00'
  and v.starts_at = date_trunc('minute', v.starts_at)
  and exists (
    select 1 from public.locations loc
    where loc.organization_id = o.id
      and loc.timezone = 'America/Mexico_City'
  );

update public.visit_invitations i
set expires_at = (i.expires_at at time zone 'America/Mexico_City') at time zone 'America/Tijuana'
from public.visits v
join public.organizations o on o.id = v.organization_id
where i.visit_id = v.id
  and o.name = 'Sohnen'
  and v.origin = 'host_invitation'
  and v.created_at >= timestamptz '2026-10-25 15:06:00+00'
  and i.expires_at is not null
  and i.expires_at = date_trunc('minute', i.expires_at)
  and exists (
    select 1 from public.locations loc
    where loc.organization_id = o.id
      and loc.timezone = 'America/Mexico_City'
  );

update public.qr_tokens q
set expires_at = (q.expires_at at time zone 'America/Mexico_City') at time zone 'America/Tijuana'
from public.visits v
join public.organizations o on o.id = v.organization_id
where q.visit_id = v.id
  and q.revoked_at is null
  and o.name = 'Sohnen'
  and v.origin = 'host_invitation'
  and v.created_at >= timestamptz '2026-10-25 15:06:00+00'
  and q.expires_at = date_trunc('minute', q.expires_at)
  and exists (
    select 1 from public.locations loc
    where loc.organization_id = o.id
      and loc.timezone = 'America/Mexico_City'
  );

update public.locations l
set timezone = 'America/Tijuana'
from public.organizations o
where l.organization_id = o.id
  and o.name = 'Sohnen'
  and l.timezone = 'America/Mexico_City';

alter table public.visits enable trigger enforce_visit_update_permissions;
