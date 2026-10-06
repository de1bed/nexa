-- ============================================================================
-- Retención ilimitada de identificaciones
--
-- Hasta ahora toda identificación tenía fecha de borrado (7 a 90 días). Se
-- agrega el modo «ilimitado», que pasa a ser el predeterminado y se aplica a
-- todas las empresas actuales y a los documentos que ya están guardados.
--
-- retention_expires_at = null significa «no se borra». El cron de retención
-- filtra con `<= now()`, así que una fecha nula nunca entra en la purga.
-- El plazo en días se conserva para cuando la empresa vuelva a un plazo fijo.
-- ============================================================================

alter table public.organization_settings
  add column if not exists document_retention_unlimited boolean not null default true;

update public.organization_settings
set document_retention_unlimited = true
where document_retention_unlimited is distinct from true;

alter table public.visitor_documents
  alter column retention_expires_at drop not null;

-- Lo que aún existe deja de tener fecha de borrado. Lo ya purgado no se recupera.
update public.visitor_documents
set retention_expires_at = null
where deleted_at is null
  and retention_expires_at is not null;

-- ---------------------------------------------------------------------------
-- Recalcula la fecha de borrado de los documentos vivos de una empresa según
-- su configuración vigente. La llama la API al guardar la configuración.
--   ilimitado  -> todos quedan sin fecha.
--   plazo fijo -> los que no tenían fecha reciben created_at + días.
-- ---------------------------------------------------------------------------
create or replace function public.apply_document_retention(p_org uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  s public.organization_settings%rowtype;
  affected integer := 0;
begin
  if not public.has_role(p_org, array['superadmin', 'admin']::public.member_role[]) then
    raise exception 'Acceso denegado' using errcode = '42501';
  end if;

  select * into s from public.organization_settings where organization_id = p_org;
  if s.id is null then return 0; end if;

  if s.document_retention_unlimited then
    update public.visitor_documents
    set retention_expires_at = null
    where organization_id = p_org
      and deleted_at is null
      and retention_expires_at is not null;
  else
    update public.visitor_documents
    set retention_expires_at = created_at + make_interval(days => s.document_retention_days)
    where organization_id = p_org
      and deleted_at is null
      and retention_expires_at is null;
  end if;
  get diagnostics affected = row_count;

  insert into public.audit_logs (organization_id, actor_id, event_type, metadata)
  values (p_org, auth.uid(), 'retention_applied', jsonb_build_object(
    'unlimited', s.document_retention_unlimited,
    'days', s.document_retention_days,
    'documents', affected));

  return affected;
end $fn$;

revoke all on function public.apply_document_retention(uuid) from public, anon;
grant execute on function public.apply_document_retention(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- La invitación pública le dice al visitante cuánto se conserva su INE.
-- ---------------------------------------------------------------------------
drop function if exists public.resolve_invitation(text);
create function public.resolve_invitation(p_token text)
returns table(
  visit_id uuid, organization_name text, location_name text, location_address text,
  host_name text, visitor_name text, visitor_email text, visitor_phone text, visitor_company text,
  starts_at timestamptz, ends_at timestamptz, purpose text, access_requirements text,
  internal_place text, meeting_url text,
  privacy_notice text, retention_days integer, retention_unlimited boolean,
  require_identification boolean, visitor_flow jsonb, state text
)
language sql stable security definer set search_path = '' as $fn$
  select v.id, o.name, l.name, l.address, p.full_name,
    coalesce(i.invitee_name, x.full_name, ''), coalesce(i.invitee_email, x.email, ''),
    coalesce(i.invitee_phone, x.phone, ''), coalesce(i.invitee_company, x.company, v.visitor_company, ''),
    v.starts_at, v.ends_at, v.purpose, coalesce(v.access_requirements, ''),
    coalesce(v.internal_place, ''), coalesce(v.meeting_url, ''),
    coalesce(s.privacy_notice, ''), coalesce(s.document_retention_days, 30),
    coalesce(s.document_retention_unlimited, true),
    coalesce(s.require_identification, true),
    coalesce(
      s.visitor_flow,
      jsonb_build_object(
        'identity', 'required',
        'identification', case when coalesce(s.require_identification, true) then 'required' else 'off' end,
        'vehicle', 'optional',
        'notes', 'optional',
        'attachments', 'off',
        'consent', 'required'
      )
    ),
    case when i.revoked_at is not null or v.status = 'cancelled' then 'cancelled'
      when i.expires_at < now() then 'expired'
      when i.completed_at is not null then 'completed'
      else 'active' end
  from public.visit_invitations i
  join public.visits v on v.id = i.visit_id
  join public.organizations o on o.id = v.organization_id
  join public.locations l on l.id = v.location_id
  join public.profiles p on p.id = v.host_id
  left join public.visitors x on x.id = v.visitor_id
  left join public.organization_settings s on s.organization_id = v.organization_id
  where i.token_hash = public.token_hash(p_token)
  limit 1
$fn$;

revoke all on function public.resolve_invitation(text) from public;
grant execute on function public.resolve_invitation(text) to anon, authenticated;
