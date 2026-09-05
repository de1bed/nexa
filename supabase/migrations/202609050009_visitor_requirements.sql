-- Lo que se le pide al visitante es política de la empresa, no del producto.
-- Por omisión se sigue pidiendo identificación; el admin puede apagarlo.

alter table public.organization_settings
  add column if not exists require_identification boolean not null default true;

drop function if exists public.resolve_invitation(text);
create function public.resolve_invitation(p_token text)
returns table(
  visit_id uuid, organization_name text, location_name text, location_address text,
  host_name text, visitor_name text, visitor_email text, visitor_phone text, visitor_company text,
  starts_at timestamptz, ends_at timestamptz, purpose text, access_requirements text,
  privacy_notice text, retention_days integer, require_identification boolean, state text
)
language sql stable security definer set search_path = '' as $fn$
  select v.id, o.name, l.name, l.address, p.full_name,
    coalesce(i.invitee_name, x.full_name, ''), coalesce(i.invitee_email, x.email, ''),
    coalesce(i.invitee_phone, x.phone, ''), coalesce(i.invitee_company, x.company, v.visitor_company, ''),
    v.starts_at, v.ends_at, v.purpose, coalesce(v.access_requirements, ''),
    coalesce(s.privacy_notice, ''), coalesce(s.document_retention_days, 30),
    coalesce(s.require_identification, true),
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
