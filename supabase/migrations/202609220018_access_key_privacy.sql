-- La clave de empresa solo la leen administración y la consola de plataforma.
-- Un integrante normal no puede pedirla aunque sea miembro de la organización.

create or replace function public.organization_access_key(p_org uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    return null;
  end if;
  if not public.has_role(p_org, array['superadmin', 'admin']::public.member_role[]) then
    return null;
  end if;
  return (
    select access_key from public.organizations where id = p_org
  );
end;
$$;

revoke all on function public.organization_access_key(uuid) from public, anon;
grant execute on function public.organization_access_key(uuid) to authenticated;

revoke select (access_key) on public.organizations from public, anon, authenticated;

-- Un GRANT de tabla vuelve inútil el revoke por columna. Se quita el SELECT
-- de tabla y se devuelve solo el resto de columnas.
revoke select on public.organizations from public, anon, authenticated;
grant select (
  id, name, slug, logo_path, active, created_at, updated_at, service_status
) on public.organizations to authenticated;

revoke execute on function public.create_organization(text, text, text, text, text) from public, anon, authenticated;

revoke update on public.organizations from public, anon, authenticated;
