-- Clave de empresa, solicitudes de acceso, departamentos y consola de plataforma.
-- Quien ya es miembro sigue activo. La clave no abre la puerta sola: pide un rol
-- y el administrador de la empresa acepta. La invitación por correo no usa la clave.

alter table public.organizations
  add column if not exists access_key text,
  add column if not exists service_status text not null default 'active';

alter table public.organizations
  drop constraint if exists organizations_service_status_check;

alter table public.organizations
  add constraint organizations_service_status_check
  check (service_status in ('active', 'suspended'));

create or replace function public.generate_access_key()
returns text
language plpgsql
set search_path = ''
as $$
declare
  alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  body text := '';
  i integer;
  candidate text;
begin
  loop
    body := '';
    for i in 1..8 loop
      body := body || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    candidate := 'NEXA-' || substr(body, 1, 4) || '-' || substr(body, 5, 4);
    exit when not exists (
      select 1 from public.organizations o where o.access_key = candidate
    );
  end loop;
  return candidate;
end;
$$;

revoke all on function public.generate_access_key() from public, anon, authenticated;

update public.organizations
set access_key = public.generate_access_key()
where access_key is null;

alter table public.organizations
  alter column access_key set not null;

create unique index if not exists organizations_access_key_idx
  on public.organizations (access_key);

create or replace function public.protect_organization_service()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if auth.role() = 'authenticated' then
    new.access_key := old.access_key;
    new.service_status := old.service_status;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_organization_service on public.organizations;
create trigger protect_organization_service
  before update on public.organizations
  for each row execute function public.protect_organization_service();

create table if not exists public.departments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create unique index if not exists departments_org_name_idx
  on public.departments (organization_id, lower(name))
  where active;

alter table public.organization_members
  add column if not exists department_id uuid references public.departments(id);

create table if not exists public.access_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  requested_role public.member_role not null,
  department_id uuid references public.departments(id),
  status text not null default 'pending',
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint access_requests_status_check check (status in ('pending', 'approved', 'rejected')),
  constraint access_requests_role_check check (requested_role in ('admin', 'host', 'guard')),
  unique (organization_id, profile_id)
);

create index if not exists access_requests_org_pending_idx
  on public.access_requests (organization_id, created_at desc)
  where status = 'pending';

create table if not exists public.platform_admins (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  email text not null,
  created_at timestamptz not null default now()
);

alter table public.departments enable row level security;
alter table public.access_requests enable row level security;
alter table public.platform_admins enable row level security;

drop policy if exists departments_select on public.departments;
create policy departments_select on public.departments
  for select using (public.is_member(organization_id));

drop policy if exists departments_admin on public.departments;
create policy departments_admin on public.departments
  for all
  using (public.has_role(organization_id, array['superadmin','admin']::public.member_role[]))
  with check (public.has_role(organization_id, array['superadmin','admin']::public.member_role[]));

drop policy if exists access_requests_select on public.access_requests;
create policy access_requests_select on public.access_requests
  for select using (
    profile_id = auth.uid()
    or public.has_role(organization_id, array['superadmin','admin']::public.member_role[])
  );

grant select, insert, update, delete on public.departments to authenticated;
grant select on public.access_requests to authenticated;

create or replace function public.preview_access_key(p_key text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  org public.organizations%rowtype;
  areas jsonb;
begin
  if auth.uid() is null then
    return jsonb_build_object('state', 'unauthenticated');
  end if;

  select * into org
  from public.organizations
  where access_key = upper(trim(coalesce(p_key, '')))
  limit 1;

  if org.id is null or org.service_status <> 'active' then
    return jsonb_build_object('state', 'invalid');
  end if;

  select coalesce(jsonb_agg(jsonb_build_object('id', d.id, 'name', d.name) order by d.name), '[]'::jsonb)
  into areas
  from public.departments d
  where d.organization_id = org.id and d.active;

  return jsonb_build_object(
    'state', 'ok',
    'organizationName', org.name,
    'departments', areas
  );
end;
$$;

create or replace function public.submit_access_request(
  p_key text,
  p_role text,
  p_department uuid
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  org public.organizations%rowtype;
  existing public.organization_members%rowtype;
  dept_count integer;
begin
  if uid is null then
    return jsonb_build_object('state', 'unauthenticated');
  end if;
  if p_role not in ('admin', 'host', 'guard') then
    return jsonb_build_object('state', 'invalid_role');
  end if;

  select * into org
  from public.organizations
  where access_key = upper(trim(coalesce(p_key, '')))
  limit 1;

  if org.id is null or org.service_status <> 'active' then
    return jsonb_build_object('state', 'invalid');
  end if;

  select * into existing
  from public.organization_members
  where organization_id = org.id and profile_id = uid;

  if existing.profile_id is not null and existing.status = 'active' then
    return jsonb_build_object(
      'state', 'active',
      'organizationId', org.id,
      'role', existing.role
    );
  end if;

  if existing.profile_id is not null and existing.status = 'invited' then
    return jsonb_build_object('state', 'invited', 'organizationName', org.name);
  end if;

  select count(*) into dept_count
  from public.departments
  where organization_id = org.id and active;

  if dept_count > 0 and p_department is null then
    return jsonb_build_object('state', 'department_required', 'organizationName', org.name);
  end if;

  if p_department is not null and not exists (
    select 1 from public.departments d
    where d.id = p_department and d.organization_id = org.id and d.active
  ) then
    return jsonb_build_object('state', 'invalid_department');
  end if;

  insert into public.access_requests (
    organization_id, profile_id, requested_role, department_id, status, reviewed_by, reviewed_at
  ) values (
    org.id, uid, p_role::public.member_role, p_department, 'pending', null, null
  )
  on conflict (organization_id, profile_id) do update
    set requested_role = excluded.requested_role,
        department_id = excluded.department_id,
        status = 'pending',
        reviewed_by = null,
        reviewed_at = null,
        created_at = now();

  return jsonb_build_object(
    'state', 'pending',
    'organizationName', org.name,
    'organizationId', org.id
  );
end;
$$;

create or replace function public.my_access_gate()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  membership public.organization_members%rowtype;
  request public.access_requests%rowtype;
  org_name text;
begin
  if uid is null then
    return jsonb_build_object('state', 'unauthenticated');
  end if;

  select * into membership
  from public.organization_members
  where profile_id = uid and status = 'active'
  limit 1;

  if membership.profile_id is not null then
    return jsonb_build_object(
      'state', 'active',
      'organizationId', membership.organization_id,
      'role', membership.role
    );
  end if;

  select * into request
  from public.access_requests
  where profile_id = uid
  order by created_at desc
  limit 1;

  if request.id is null then
    return jsonb_build_object('state', 'none');
  end if;

  select name into org_name from public.organizations where id = request.organization_id;

  return jsonb_build_object(
    'state', request.status,
    'organizationName', org_name,
    'organizationId', request.organization_id,
    'role', request.requested_role
  );
end;
$$;

create or replace function public.review_access_request(
  p_request uuid,
  p_decision text,
  p_role text,
  p_department uuid
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  request public.access_requests%rowtype;
  next_role public.member_role;
begin
  if uid is null then
    return jsonb_build_object('state', 'unauthenticated');
  end if;
  if p_decision not in ('approve', 'reject') then
    return jsonb_build_object('state', 'invalid');
  end if;

  select * into request from public.access_requests where id = p_request;
  if request.id is null then
    return jsonb_build_object('state', 'missing');
  end if;

  if not public.has_role(request.organization_id, array['superadmin','admin']::public.member_role[]) then
    return jsonb_build_object('state', 'forbidden');
  end if;

  if p_decision = 'reject' then
    update public.access_requests
    set status = 'rejected', reviewed_by = uid, reviewed_at = now()
    where id = request.id;
    return jsonb_build_object('state', 'rejected');
  end if;

  if p_role is null or p_role not in ('admin', 'host', 'guard') then
    next_role := request.requested_role;
  else
    next_role := p_role::public.member_role;
  end if;

  if p_department is not null and not exists (
    select 1 from public.departments d
    where d.id = p_department and d.organization_id = request.organization_id and d.active
  ) then
    return jsonb_build_object('state', 'invalid_department');
  end if;

  insert into public.organization_members (
    organization_id, profile_id, role, status, active, department_id, invited_by, joined_at
  ) values (
    request.organization_id, request.profile_id, next_role, 'active', true,
    coalesce(p_department, request.department_id), uid, now()
  )
  on conflict (organization_id, profile_id) do update
    set role = excluded.role,
        status = 'active',
        active = true,
        department_id = excluded.department_id,
        joined_at = coalesce(public.organization_members.joined_at, now());

  update public.access_requests
  set status = 'approved',
      requested_role = next_role,
      department_id = coalesce(p_department, request.department_id),
      reviewed_by = uid,
      reviewed_at = now()
  where id = request.id;

  return jsonb_build_object('state', 'approved', 'role', next_role);
end;
$$;

revoke all on function public.preview_access_key(text) from public, anon;
revoke all on function public.submit_access_request(text, text, uuid) from public, anon;
revoke all on function public.my_access_gate() from public, anon;
revoke all on function public.review_access_request(uuid, text, text, uuid) from public, anon;

grant execute on function public.preview_access_key(text) to authenticated;
grant execute on function public.submit_access_request(text, text, uuid) to authenticated;
grant execute on function public.my_access_gate() to authenticated;
grant execute on function public.review_access_request(uuid, text, text, uuid) to authenticated;

create or replace function public.create_organization(
  p_name text,
  p_full_name text,
  p_location_name text default 'Recepción principal',
  p_location_address text default 'Por definir',
  p_timezone text default 'America/Mexico_City'
) returns table(organization_id uuid, organization_name text, organization_slug text)
language plpgsql security definer set search_path = '' as $fn$
declare
  uid uuid := auth.uid();
  base_slug text;
  final_slug text;
  suffix integer := 0;
  new_org uuid;
  user_email text;
begin
  if uid is null then raise exception 'No autenticado' using errcode = '42501'; end if;
  if char_length(trim(coalesce(p_name, ''))) < 2 then raise exception 'Nombre de organización inválido'; end if;

  select email into user_email from auth.users where id = uid;

  insert into public.profiles (id, full_name, email)
  values (uid, coalesce(nullif(trim(coalesce(p_full_name, '')), ''), split_part(user_email, '@', 1)), user_email)
  on conflict (id) do update set full_name = excluded.full_name, email = excluded.email;

  base_slug := coalesce(nullif(public.slugify(p_name), ''), 'org');
  final_slug := base_slug;
  while exists (select 1 from public.organizations o where o.slug = final_slug) loop
    suffix := suffix + 1;
    final_slug := base_slug || '-' || suffix::text;
  end loop;

  insert into public.organizations (name, slug, access_key)
  values (trim(p_name), final_slug, public.generate_access_key())
  returning id into new_org;

  insert into public.organization_members (organization_id, profile_id, role)
  values (new_org, uid, 'admin');

  insert into public.organization_settings (organization_id, privacy_notice)
  values (new_org, 'Los datos personales que proporcionas se utilizan únicamente para gestionar, ' ||
    'controlar y auditar tu acceso a nuestras instalaciones. Tu identificación se conserva de forma ' ||
    'privada durante el periodo de retención configurado y después se elimina de manera permanente. ' ||
    'No realizamos reconocimiento facial ni almacenamos datos biométricos.');

  insert into public.locations (organization_id, name, address, timezone)
  values (new_org, coalesce(nullif(trim(coalesce(p_location_name, '')), ''), 'Recepción principal'),
          coalesce(nullif(trim(coalesce(p_location_address, '')), ''), 'Por definir'),
          coalesce(nullif(trim(coalesce(p_timezone, '')), ''), 'America/Mexico_City'));

  insert into public.audit_logs (organization_id, actor_id, event_type, metadata)
  values (new_org, uid, 'organization_created', jsonb_build_object('slug', final_slug));

  return query select new_org, trim(p_name), final_slug;
end $fn$;
