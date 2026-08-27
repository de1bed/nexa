alter table public.visit_invitations
  add column if not exists invitee_name text,
  add column if not exists invitee_email text,
  add column if not exists invitee_phone text,
  add column if not exists invitee_company text;

drop function if exists public.resolve_invitation(text);

create or replace function public.resolve_invitation(p_token text)
returns table(
  visit_id uuid, organization_name text, location_name text, host_name text,
  visitor_name text, visitor_email text, visitor_phone text, visitor_company text,
  starts_at timestamptz, ends_at timestamptz, purpose text, state text
)
language sql stable security definer set search_path='' as $$
  select v.id,o.name,l.name,p.full_name,
    coalesce(i.invitee_name,x.full_name,''),coalesce(i.invitee_email,x.email,''),
    coalesce(i.invitee_phone,x.phone,''),coalesce(i.invitee_company,x.company,v.visitor_company,''),
    v.starts_at,v.ends_at,v.purpose,
    case when i.revoked_at is not null or v.status='cancelled' then 'cancelled'
      when i.expires_at<now() then 'expired'
      when i.completed_at is not null then 'completed' else 'active' end
  from public.visit_invitations i
  join public.visits v on v.id=i.visit_id
  join public.organizations o on o.id=v.organization_id
  join public.locations l on l.id=v.location_id
  join public.profiles p on p.id=v.host_id
  left join public.visitors x on x.id=v.visitor_id
  where i.token_hash=encode(digest(p_token,'sha256'),'hex') limit 1
$$;

revoke all on function public.resolve_invitation(text) from public;
grant execute on function public.resolve_invitation(text) to anon,authenticated;
