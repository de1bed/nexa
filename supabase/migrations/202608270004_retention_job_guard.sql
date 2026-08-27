-- Storage objects must be removed through the Storage API. Prevent the legacy
-- database-only helper from marking rows deleted while leaving private files behind.
create or replace function public.purge_expired_documents() returns integer
language plpgsql security definer set search_path = '' as $$
begin
  raise exception 'Use the authenticated retention worker; physical Storage deletion is required';
end;
$$;

revoke all on function public.purge_expired_documents() from public, anon, authenticated;
grant execute on function public.purge_expired_documents() to service_role;
