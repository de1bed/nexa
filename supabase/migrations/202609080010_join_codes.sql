-- ============================================================================
-- NEXA VISIT — Códigos de invitación para unirse a una organización
-- Permite agregar miembros sin depender del correo electrónico.
-- ============================================================================

-- Tabla para códigos de unión activos por organización
create table if not exists public.organization_join_codes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  code text not null unique,
  role public.member_role not null default 'host',
  uses_remaining integer, -- null = ilimitado
  expires_at timestamptz,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);

create index join_codes_org_idx on public.organization_join_codes(organization_id) where revoked_at is null;
create index join_codes_code_idx on public.organization_join_codes(code) where revoked_at is null;

alter table public.organization_join_codes enable row level security;

create policy join_codes_admin_select on public.organization_join_codes
  for select using (public.has_role(organization_id, array['superadmin','admin']::public.member_role[]));
create policy join_codes_admin_insert on public.organization_join_codes
  for insert with check (public.has_role(organization_id, array['superadmin','admin']::public.member_role[]));
create policy join_codes_admin_update on public.organization_join_codes
  for update using (public.has_role(organization_id, array['superadmin','admin']::public.member_role[]));

-- Función para validar y usar un código de unión
create or replace function public.use_join_code(p_code text)
returns table(
  organization_id uuid,
  organization_name text,
  role public.member_role,
  already_member boolean
)
language plpgsql security definer set search_path = '' as $fn$
declare
  uid uuid := auth.uid();
  jc record;
  existing_member boolean;
begin
  if uid is null then
    raise exception 'No autenticado' using errcode = '42501';
  end if;

  -- Buscar código válido
  select c.*, o.name as org_name into jc
  from public.organization_join_codes c
  join public.organizations o on o.id = c.organization_id
  where c.code = p_code
    and c.revoked_at is null
    and (c.expires_at is null or c.expires_at > now())
    and (c.uses_remaining is null or c.uses_remaining > 0);

  if jc.id is null then
    raise exception 'Código inválido o expirado';
  end if;

  -- Verificar si ya es miembro
  select true into existing_member
  from public.organization_members m
  where m.organization_id = jc.organization_id
    and m.profile_id = uid
    and m.active;

  if existing_member then
    return query select jc.organization_id, jc.org_name, jc.role, true;
    return;
  end if;

  -- Agregar como miembro
  insert into public.organization_members (organization_id, profile_id, role, active)
  values (jc.organization_id, uid, jc.role, true)
  on conflict (organization_id, profile_id)
  do update set role = jc.role, active = true;

  -- Decrementar usos si tiene límite
  if jc.uses_remaining is not null then
    update public.organization_join_codes
    set uses_remaining = uses_remaining - 1
    where id = jc.id;
  end if;

  -- Registrar en auditoría
  insert into public.audit_logs (organization_id, actor_id, event_type, metadata)
  values (jc.organization_id, uid, 'member_joined_via_code', jsonb_build_object('role', jc.role::text, 'code_id', jc.id));

  return query select jc.organization_id, jc.org_name, jc.role, false;
end $fn$;

revoke all on function public.use_join_code(text) from public, anon;
grant execute on function public.use_join_code(text) to authenticated;

-- Función para generar un código aleatorio de 8 caracteres
create or replace function public.generate_join_code()
returns text language sql as $fn$
  select upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8))
$fn$;
