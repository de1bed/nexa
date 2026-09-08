-- ============================================================================
-- NEXA VISIT — Estado de miembros e invitaciones de equipo
-- Un integrante puede estar invitado, activo o suspendido. El enlace de
-- invitación lleva a crear la cuenta (correo + contraseña) bajo la empresa.
-- ============================================================================

do $$ begin
  create type public.member_status as enum ('invited', 'active', 'suspended');
exception when duplicate_object then null;
end $$;

alter table public.organization_members
  add column if not exists status public.member_status not null default 'active',
  add column if not exists invited_by uuid references public.profiles(id),
  add column if not exists joined_at timestamptz,
  add column if not exists invite_delivery text;

update public.organization_members
set
  status = case when active then 'active'::public.member_status else 'suspended'::public.member_status end,
  joined_at = coalesce(joined_at, created_at)
where joined_at is null;

create or replace function public.organization_members_sync_status()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and new.active is distinct from old.active then
    if new.active then
      new.status := 'active';
    elsif new.status = 'active' then
      new.status := 'suspended';
    end if;
  end if;

  if new.status = 'active' then
    new.active := true;
    if new.joined_at is null then
      new.joined_at := now();
    end if;
  elsif new.status in ('invited', 'suspended') then
    new.active := false;
  end if;

  return new;
end;
$$;

drop trigger if exists organization_members_sync_status on public.organization_members;
create trigger organization_members_sync_status
  before insert or update on public.organization_members
  for each row execute function public.organization_members_sync_status();

create table if not exists public.team_invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  invited_by uuid not null references public.profiles(id),
  email text not null,
  role public.member_role not null,
  token_hash text not null unique,
  token_hint text not null,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists team_invitations_org_idx
  on public.team_invitations(organization_id)
  where revoked_at is null and accepted_at is null;
create index if not exists team_invitations_profile_idx
  on public.team_invitations(organization_id, profile_id);

alter table public.team_invitations enable row level security;

drop policy if exists team_invitations_admin on public.team_invitations;
create policy team_invitations_admin on public.team_invitations
  for all
  using (public.has_role(organization_id, array['superadmin','admin']::public.member_role[]))
  with check (public.has_role(organization_id, array['superadmin','admin']::public.member_role[]));

drop trigger if exists set_updated_at_team_invitations on public.team_invitations;
create trigger set_updated_at_team_invitations
  before update on public.team_invitations
  for each row execute function public.set_updated_at();

create or replace function public.resolve_team_invite(p_token text)
returns table(
  organization_name text,
  inviter_name text,
  invitee_name text,
  invitee_email text,
  role public.member_role,
  state text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    o.name,
    inv.full_name,
    p.full_name,
    i.email,
    i.role,
    case
      when i.revoked_at is not null then 'revoked'
      when i.accepted_at is not null then 'accepted'
      when i.expires_at < now() then 'expired'
      else 'pending'
    end
  from public.team_invitations i
  join public.organizations o on o.id = i.organization_id
  join public.profiles inv on inv.id = i.invited_by
  join public.profiles p on p.id = i.profile_id
  where i.token_hash = public.token_hash(p_token)
  limit 1;
$$;

revoke all on function public.resolve_team_invite(text) from public, anon, authenticated;
grant execute on function public.resolve_team_invite(text) to anon, authenticated;

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

  select true into existing_member
  from public.organization_members m
  where m.organization_id = jc.organization_id
    and m.profile_id = uid
    and m.status = 'active';

  if existing_member then
    return query select jc.organization_id, jc.org_name, jc.role, true;
    return;
  end if;

  insert into public.organization_members (organization_id, profile_id, role, status, active, joined_at)
  values (jc.organization_id, uid, jc.role, 'active', true, now())
  on conflict (organization_id, profile_id)
  do update set role = jc.role, status = 'active', active = true, joined_at = coalesce(public.organization_members.joined_at, now());

  if jc.uses_remaining is not null then
    update public.organization_join_codes
    set uses_remaining = uses_remaining - 1
    where id = jc.id;
  end if;

  insert into public.audit_logs (organization_id, actor_id, event_type, metadata)
  values (jc.organization_id, uid, 'member_joined_via_code', jsonb_build_object('role', jc.role::text, 'code_id', jc.id));

  return query select jc.organization_id, jc.org_name, jc.role, false;
end $fn$;
