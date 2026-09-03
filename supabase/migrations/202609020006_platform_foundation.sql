-- ============================================================================
-- NEXA VISIT — Fundación de plataforma
-- 1. Hashing de tokens sin depender del esquema de pgcrypto.
-- 2. Alta autónoma de empresas (onboarding) y perfiles automáticos.
-- 3. Ventanas de acceso configurables por organización.
-- 4. Correcciones de RLS y de alcance por rol.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Hash canónico de tokens
-- digest() vive en el esquema "extensions" de Supabase y no se resuelve con
-- search_path = ''. sha256() y convert_to() son built-ins de pg_catalog,
-- siempre resolubles, y producen el mismo hash que Node:
--   createHash("sha256").update(token).digest("hex")
-- ---------------------------------------------------------------------------
create or replace function public.token_hash(p_token text)
returns text language sql immutable security definer set search_path = '' as $fn$
  select encode(pg_catalog.sha256(pg_catalog.convert_to(p_token, 'UTF8')), 'hex')
$fn$;
revoke all on function public.token_hash(text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Perfil automático para cada usuario de Auth
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $fn$
begin
  insert into public.profiles (id, full_name, email)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), split_part(new.email, '@', 1)),
    new.email
  )
  on conflict (id) do update
    set email = excluded.email,
        full_name = coalesce(nullif(trim(public.profiles.full_name), ''), excluded.full_name);
  return new;
end $fn$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- 3. Onboarding: una empresa se da de alta sola y queda operativa
-- ---------------------------------------------------------------------------
create or replace function public.unaccent_fallback(p_value text)
returns text language sql immutable set search_path = '' as $fn$
  select translate(p_value,
    'áàäâãéèëêíìïîóòöôõúùüûñçÁÀÄÂÃÉÈËÊÍÌÏÎÓÒÖÔÕÚÙÜÛÑÇ',
    'aaaaaeeeeiiiiooooouuuuncAAAAAEEEEIIIIOOOOOUUUUNC')
$fn$;

create or replace function public.slugify(p_value text)
returns text language sql immutable set search_path = '' as $fn$
  select trim(both '-' from regexp_replace(
    lower(public.unaccent_fallback(p_value)), '[^a-z0-9]+', '-', 'g'))
$fn$;

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

  insert into public.organizations (name, slug)
  values (trim(p_name), final_slug)
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

revoke all on function public.create_organization(text, text, text, text, text) from public, anon;
grant execute on function public.create_organization(text, text, text, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Resolución de tokens públicos (sin pgcrypto)
-- ---------------------------------------------------------------------------
drop function if exists public.resolve_invitation(text);
create function public.resolve_invitation(p_token text)
returns table(
  visit_id uuid, organization_name text, location_name text, location_address text,
  host_name text, visitor_name text, visitor_email text, visitor_phone text, visitor_company text,
  starts_at timestamptz, ends_at timestamptz, purpose text, access_requirements text,
  privacy_notice text, retention_days integer, state text
)
language sql stable security definer set search_path = '' as $fn$
  select v.id, o.name, l.name, l.address, p.full_name,
    coalesce(i.invitee_name, x.full_name, ''), coalesce(i.invitee_email, x.email, ''),
    coalesce(i.invitee_phone, x.phone, ''), coalesce(i.invitee_company, x.company, v.visitor_company, ''),
    v.starts_at, v.ends_at, v.purpose, coalesce(v.access_requirements, ''),
    coalesce(s.privacy_notice, ''), coalesce(s.document_retention_days, 30),
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

-- El alcance organizacional se valida DENTRO de la función, no solo en la API.
drop function if exists public.resolve_qr_token(text);
create function public.resolve_qr_token(p_token text)
returns table(
  visit_id uuid, organization_id uuid, location_id uuid, location_name text,
  visitor_name text, visitor_company text, visitor_phone text, host_name text, host_email text,
  purpose text, vehicle_plate text, visitor_notes text, access_requirements text,
  starts_at timestamptz, ends_at timestamptz, checked_in_at timestamptz,
  visit_status public.visit_status, token_state text, document_captured boolean
)
language plpgsql security definer set search_path = '' as $fn$
declare
  hashed text := public.token_hash(p_token);
  org uuid;
begin
  select q.organization_id into org from public.qr_tokens q where q.token_hash = hashed;
  if org is null then return; end if;

  if not exists (
    select 1 from public.organization_members m
    where m.organization_id = org and m.profile_id = auth.uid()
      and m.active and m.role in ('superadmin', 'admin', 'guard')
  ) then
    raise exception 'Acceso denegado' using errcode = '42501';
  end if;

  insert into public.audit_logs (organization_id, visit_id, actor_id, event_type, metadata)
  select q.organization_id, q.visit_id, auth.uid(), 'qr_scanned',
    jsonb_build_object('result', case
      when q.revoked_at is not null then 'revoked'
      when q.expires_at < now() then 'expired'
      else 'resolved' end)
  from public.qr_tokens q where q.token_hash = hashed;

  return query
  select v.id, v.organization_id, v.location_id, l.name,
    coalesce(x.full_name, 'Visitante'), coalesce(v.visitor_company, x.company, ''),
    coalesce(x.phone, ''), h.full_name, coalesce(h.email, ''),
    v.purpose, coalesce(v.vehicle_plate, ''), coalesce(v.visitor_notes, ''),
    coalesce(v.access_requirements, ''),
    v.starts_at, v.ends_at, v.checked_in_at, v.status,
    case when q.revoked_at is not null then 'revoked'
      when v.status = 'cancelled' then 'cancelled'
      when v.status = 'checked_out' then 'used'
      when q.expires_at < now() then 'expired'
      when now() < q.valid_from then 'early'
      else 'valid' end,
    exists (select 1 from public.visitor_documents d where d.visit_id = v.id and d.deleted_at is null)
  from public.qr_tokens q
  join public.visits v on v.id = q.visit_id
  join public.locations l on l.id = v.location_id
  left join public.visitors x on x.id = v.visitor_id
  join public.profiles h on h.id = v.host_id
  where q.token_hash = hashed
  limit 1;
end $fn$;
revoke all on function public.resolve_qr_token(text) from public;
grant execute on function public.resolve_qr_token(text) to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Decisión de acceso: superadmin incluido y ventanas configurables
-- ---------------------------------------------------------------------------
create or replace function public.record_access_decision(
  p_visit_id uuid, p_decision text, p_reason text default null, p_allow_outside_window boolean default false)
returns public.visits language plpgsql security definer set search_path = '' as $fn$
declare
  v public.visits;
  allowed boolean;
  early_minutes integer;
  late_minutes integer;
begin
  select * into v from public.visits where id = p_visit_id for update;
  if v.id is null then raise exception 'Visita no disponible'; end if;

  select true into allowed from public.organization_members
  where profile_id = auth.uid() and organization_id = v.organization_id
    and active and role in ('superadmin', 'admin', 'guard')
  limit 1;
  if allowed is not true then raise exception 'Acceso denegado' using errcode = '42501'; end if;

  select coalesce(s.early_entry_minutes, 15), coalesce(s.late_entry_minutes, 30)
    into early_minutes, late_minutes
  from public.organization_settings s where s.organization_id = v.organization_id;
  early_minutes := coalesce(early_minutes, 15);
  late_minutes := coalesce(late_minutes, 30);

  if p_decision = 'check_in' then
    if v.status = 'checked_in' then return v; end if;
    if v.status in ('checked_out', 'cancelled', 'denied', 'expired') then
      raise exception 'La visita ya fue cerrada o cancelada';
    end if;
    if not p_allow_outside_window
       and now() not between v.starts_at - make_interval(mins => early_minutes)
                         and v.ends_at + make_interval(mins => late_minutes) then
      raise exception 'Fuera de la ventana autorizada';
    end if;
    update public.visits set status = 'checked_in', checked_in_at = now() where id = v.id returning * into v;
    insert into public.access_events (organization_id, visit_id, location_id, actor_id, event_type, metadata)
    values (v.organization_id, v.id, v.location_id, auth.uid(), 'check_in',
            jsonb_build_object('outside_window', p_allow_outside_window));
    insert into public.audit_logs (organization_id, actor_id, visit_id, event_type)
    values (v.organization_id, auth.uid(), v.id, 'entry_approved');

  elsif p_decision = 'check_out' then
    if v.status = 'checked_out' then return v; end if;
    if v.status <> 'checked_in' then raise exception 'La entrada no está registrada'; end if;
    update public.visits set status = 'checked_out', checked_out_at = now() where id = v.id returning * into v;
    update public.qr_tokens set revoked_at = now() where visit_id = v.id and revoked_at is null;
    insert into public.access_events (organization_id, visit_id, location_id, actor_id, event_type)
    values (v.organization_id, v.id, v.location_id, auth.uid(), 'check_out');
    insert into public.audit_logs (organization_id, actor_id, visit_id, event_type)
    values (v.organization_id, auth.uid(), v.id, 'check_out');

  elsif p_decision = 'deny' then
    if nullif(trim(coalesce(p_reason, '')), '') is null then raise exception 'El motivo es obligatorio'; end if;
    if v.status in ('checked_out', 'cancelled') then raise exception 'La visita ya fue cerrada'; end if;
    update public.visits set status = 'denied', denied_at = now(), denial_reason = p_reason
      where id = v.id returning * into v;
    update public.qr_tokens set revoked_at = now() where visit_id = v.id and revoked_at is null;
    insert into public.access_events (organization_id, visit_id, location_id, actor_id, event_type, reason)
    values (v.organization_id, v.id, v.location_id, auth.uid(), 'denied', p_reason);
    insert into public.audit_logs (organization_id, actor_id, visit_id, event_type, metadata)
    values (v.organization_id, auth.uid(), v.id, 'entry_denied', jsonb_build_object('reason', p_reason));

  else
    raise exception 'Decisión inválida';
  end if;
  return v;
end $fn$;
revoke all on function public.record_access_decision(uuid, text, text, boolean) from public, anon;
grant execute on function public.record_access_decision(uuid, text, text, boolean) to authenticated;

-- El guardia también puede denegar a alguien que ya entró; el trigger lo permite.
create or replace function public.enforce_visit_update_permissions()
returns trigger language plpgsql security definer set search_path = '' as $fn$
declare
  role_name public.member_role;
  old_payload jsonb;
  new_payload jsonb;
begin
  if auth.role() = 'service_role' then return new; end if;

  select member.role into role_name
  from public.organization_members member
  where member.organization_id = old.organization_id
    and member.profile_id = auth.uid() and member.active
  limit 1;

  if role_name in ('superadmin', 'admin') then return new; end if;

  if role_name = 'host' and old.host_id = auth.uid() then
    old_payload := to_jsonb(old) - array['status','cancelled_at','cancelled_by','updated_at'];
    new_payload := to_jsonb(new) - array['status','cancelled_at','cancelled_by','updated_at'];
    if old_payload = new_payload
       and new.status = 'cancelled'
       and old.status in ('draft','invited','pre_registered','approved')
       and new.cancelled_by = auth.uid()
       and new.cancelled_at is not null then
      return new;
    end if;
    raise exception 'Actualización no permitida para anfitrión';
  end if;

  if role_name = 'guard' then
    old_payload := to_jsonb(old) - array['status','checked_in_at','checked_out_at','denied_at','denial_reason','updated_at'];
    new_payload := to_jsonb(new) - array['status','checked_in_at','checked_out_at','denied_at','denial_reason','updated_at'];
    if old_payload = new_payload and (
      (new.status = 'checked_in' and old.status in ('invited','pre_registered','approved')) or
      (new.status = 'checked_out' and old.status = 'checked_in') or
      (new.status = 'denied' and old.status in ('invited','pre_registered','approved','checked_in'))
    ) then return new; end if;
    raise exception 'Actualización no permitida para guardia';
  end if;

  raise exception 'Actualización no autorizada';
end $fn$;

-- ---------------------------------------------------------------------------
-- 6. Correcciones de RLS
-- ---------------------------------------------------------------------------
-- Un anfitrión ya no lee el padrón completo de visitantes de la organización.
drop policy if exists visitors_staff_write on public.visitors;
drop policy if exists visitors_select on public.visitors;

create policy visitors_select on public.visitors for select using (
  public.has_role(organization_id, array['superadmin','admin','guard']::public.member_role[])
  or exists (select 1 from public.visits v where v.visitor_id = visitors.id and v.host_id = auth.uid())
);
create policy visitors_staff_insert on public.visitors for insert with check (
  public.has_role(organization_id, array['superadmin','admin','guard','host']::public.member_role[])
);
create policy visitors_staff_update on public.visitors for update using (
  public.has_role(organization_id, array['superadmin','admin','guard']::public.member_role[])
) with check (
  public.has_role(organization_id, array['superadmin','admin','guard']::public.member_role[])
);

-- La vista de documento para guardias ahora sí llega al objeto en Storage.
drop policy if exists document_storage_read on storage.objects;
create policy document_storage_read on storage.objects for select using (
  bucket_id = 'visitor-documents' and (
    public.has_role((storage.foldername(name))[1]::uuid, array['superadmin','admin']::public.member_role[])
    or (
      public.has_role((storage.foldername(name))[1]::uuid, array['guard']::public.member_role[])
      and exists (
        select 1 from public.organization_settings s
        where s.organization_id = (storage.foldername(name))[1]::uuid
          and s.allow_document_preview_for_guards
      )
    )
  )
);

-- ---------------------------------------------------------------------------
-- 7. Mantenimiento: visitas vencidas que nunca llegaron
-- ---------------------------------------------------------------------------
create or replace function public.expire_stale_visits()
returns integer language plpgsql security definer set search_path = '' as $fn$
declare affected integer;
begin
  update public.visits
  set status = 'expired'
  where status in ('invited', 'pre_registered', 'approved')
    and ends_at < now() - interval '12 hours';
  get diagnostics affected = row_count;

  update public.qr_tokens q set revoked_at = now()
  from public.visits v
  where q.visit_id = v.id and v.status = 'expired' and q.revoked_at is null;

  return affected;
end $fn$;
revoke all on function public.expire_stale_visits() from public, anon, authenticated;
grant execute on function public.expire_stale_visits() to service_role;

create index if not exists visits_org_checked_in_idx on public.visits(organization_id, checked_in_at desc)
  where status = 'checked_in';
create index if not exists invitations_token_idx on public.visit_invitations(token_hash);
create index if not exists qr_tokens_token_idx on public.qr_tokens(token_hash);
