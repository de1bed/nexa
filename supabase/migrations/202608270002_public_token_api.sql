create or replace function public.resolve_invitation(p_token text)
returns table(visit_id uuid,organization_name text,location_name text,host_name text,visitor_name text,visitor_email text,starts_at timestamptz,ends_at timestamptz,purpose text,state text)
language sql stable security definer set search_path='' as $$
  select v.id,o.name,l.name,p.full_name,coalesce(x.full_name,''),coalesce(x.email,''),v.starts_at,v.ends_at,v.purpose,
    case when i.revoked_at is not null or v.status='cancelled' then 'cancelled' when i.expires_at<now() then 'expired' when i.completed_at is not null then 'completed' else 'active' end
  from public.visit_invitations i join public.visits v on v.id=i.visit_id join public.organizations o on o.id=v.organization_id
  join public.locations l on l.id=v.location_id join public.profiles p on p.id=v.host_id left join public.visitors x on x.id=v.visitor_id
  where i.token_hash=encode(digest(p_token,'sha256'),'hex') limit 1
$$;

create or replace function public.resolve_qr_token(p_token text)
returns table(visit_id uuid,organization_id uuid,location_id uuid,visitor_name text,visitor_company text,host_name text,purpose text,starts_at timestamptz,ends_at timestamptz,visit_status public.visit_status,token_state text,document_captured boolean)
language plpgsql security definer set search_path='' as $$
begin
  insert into public.audit_logs(organization_id,visit_id,event_type,metadata)
  select q.organization_id,q.visit_id,'qr_scanned',jsonb_build_object('result',case when q.revoked_at is not null then 'revoked' when q.expires_at<now() then 'expired' else 'resolved' end)
  from public.qr_tokens q where q.token_hash=encode(digest(p_token,'sha256'),'hex');
  return query select v.id,v.organization_id,v.location_id,coalesce(x.full_name,'Visitante'),coalesce(v.visitor_company,x.company,''),h.full_name,v.purpose,v.starts_at,v.ends_at,v.status,
    case when q.revoked_at is not null then 'revoked' when v.status='cancelled' then 'cancelled' when q.expires_at<now() then 'expired' when now()<q.valid_from then 'early' else 'valid' end,
    exists(select 1 from public.visitor_documents d where d.visit_id=v.id and d.deleted_at is null)
  from public.qr_tokens q join public.visits v on v.id=q.visit_id left join public.visitors x on x.id=v.visitor_id join public.profiles h on h.id=v.host_id
  where q.token_hash=encode(digest(p_token,'sha256'),'hex') limit 1;
end $$;

revoke all on function public.resolve_invitation(text) from public;
revoke all on function public.resolve_qr_token(text) from public;
grant execute on function public.resolve_invitation(text) to anon,authenticated;
grant execute on function public.resolve_qr_token(text) to authenticated;
