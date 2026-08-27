create extension if not exists pgcrypto;

create type public.member_role as enum ('superadmin','admin','host','guard');
create type public.visit_status as enum ('draft','invited','pre_registered','approved','checked_in','checked_out','denied','cancelled','expired');
create type public.visit_origin as enum ('host_invitation','public_link','guard_manual');
create type public.access_event_type as enum ('qr_scanned','check_in','check_out','denied','manual_check_in');
create type public.notification_status as enum ('pending','sent','failed','development');

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 120),
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  logo_path text,
  active boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  email text not null,
  phone text,
  avatar_path text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table public.organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  role public.member_role not null,
  active boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (organization_id, profile_id)
);

create table public.locations (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null, address text not null, timezone text not null default 'America/Tijuana', active boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(organization_id, name)
);

create table public.visitors (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  full_name text not null, email text, phone text, company text, document_type text, document_number_masked text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz
);

create table public.visits (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  location_id uuid not null references public.locations(id), visitor_id uuid references public.visitors(id), host_id uuid not null references public.profiles(id),
  status public.visit_status not null default 'draft', origin public.visit_origin not null default 'host_invitation',
  purpose text not null, visitor_company text, starts_at timestamptz not null, ends_at timestamptz not null,
  checked_in_at timestamptz, checked_out_at timestamptz, denied_at timestamptz, denial_reason text,
  vehicle_plate text, internal_notes text, visitor_notes text, access_requirements text,
  consented_at timestamptz, privacy_notice_version text, cancelled_at timestamptz, cancelled_by uuid references public.profiles(id),
  created_by uuid not null references public.profiles(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check (ends_at > starts_at), check (checked_out_at is null or checked_in_at is not null), check (checked_out_at is null or checked_out_at >= checked_in_at),
  check (status <> 'denied' or denial_reason is not null)
);

create table public.visit_invitations (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  visit_id uuid not null unique references public.visits(id) on delete cascade, token_hash text not null unique, token_hint text not null,
  expires_at timestamptz not null, completed_at timestamptz, revoked_at timestamptz, sent_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table public.visitor_documents (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  visit_id uuid not null references public.visits(id) on delete cascade, visitor_id uuid not null references public.visitors(id) on delete cascade,
  storage_path text not null unique, mime_type text not null check (mime_type in ('image/jpeg','image/png','image/webp')), size_bytes bigint not null check (size_bytes between 1 and 8388608),
  document_type text, ocr_raw_text text, ocr_confidence numeric(5,2), ocr_fields jsonb not null default '[]'::jsonb,
  retention_expires_at timestamptz not null, deleted_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table public.qr_tokens (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  visit_id uuid not null references public.visits(id) on delete cascade, token_hash text not null unique, token_hint text not null,
  valid_from timestamptz not null, expires_at timestamptz not null, revoked_at timestamptz, last_used_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), check (expires_at > valid_from)
);

create table public.access_events (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  visit_id uuid not null references public.visits(id) on delete cascade, location_id uuid not null references public.locations(id),
  actor_id uuid references public.profiles(id), event_type public.access_event_type not null, occurred_at timestamptz not null default now(),
  reason text, metadata jsonb not null default '{}'::jsonb, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  actor_id uuid references public.profiles(id), visit_id uuid references public.visits(id) on delete set null, event_type text not null,
  metadata jsonb not null default '{}'::jsonb, created_at timestamptz not null default now()
);

create table public.organization_settings (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null unique references public.organizations(id) on delete cascade,
  document_retention_days integer not null default 30 check (document_retention_days between 1 and 365),
  allow_document_preview_for_guards boolean not null default false, early_entry_minutes integer not null default 15 check (early_entry_minutes between 0 and 240),
  late_entry_minutes integer not null default 30 check (late_entry_minutes between 0 and 1440), privacy_notice text not null,
  privacy_notice_version text not null default 'mvp-1', created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table public.notification_logs (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  visit_id uuid references public.visits(id) on delete set null, channel text not null check (channel in ('email','sms','in_app')),
  recipient_masked text not null, template text not null, status public.notification_status not null default 'pending', provider_id text, error_message text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create index visits_org_start_idx on public.visits(organization_id, starts_at desc);
create index visits_org_status_idx on public.visits(organization_id, status);
create index visits_host_idx on public.visits(host_id, starts_at desc);
create index visitors_org_name_idx on public.visitors(organization_id, full_name);
create index access_events_visit_idx on public.access_events(visit_id, occurred_at desc);
create index audit_logs_org_created_idx on public.audit_logs(organization_id, created_at desc);
create index documents_retention_idx on public.visitor_documents(retention_expires_at) where deleted_at is null;

create or replace function public.set_updated_at() returns trigger language plpgsql security invoker set search_path = '' as $$ begin new.updated_at = now(); return new; end $$;
do $$ declare t text; begin foreach t in array array['organizations','profiles','organization_members','locations','visitors','visits','visit_invitations','visitor_documents','qr_tokens','access_events','organization_settings','notification_logs'] loop execute format('create trigger set_updated_at before update on public.%I for each row execute function public.set_updated_at()', t); end loop; end $$;

create or replace function public.is_member(org_id uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.organization_members m where m.organization_id=org_id and m.profile_id=auth.uid() and m.active)
$$;
create or replace function public.has_role(org_id uuid, allowed public.member_role[]) returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.organization_members m where m.organization_id=org_id and m.profile_id=auth.uid() and m.active and m.role=any(allowed))
$$;
create or replace function public.can_access_visit(v public.visits) returns boolean language sql stable security definer set search_path = '' as $$
  select public.has_role(v.organization_id,array['superadmin','admin','guard']::public.member_role[]) or
    (public.has_role(v.organization_id,array['host']::public.member_role[]) and v.host_id=auth.uid())
$$;

create or replace function public.record_access_decision(p_visit_id uuid,p_decision text,p_reason text default null,p_allow_outside_window boolean default false)
returns public.visits language plpgsql security definer set search_path='' as $$
declare v public.visits; member_org uuid;
begin
  select * into v from public.visits where id=p_visit_id for update;
  if v.id is null then raise exception 'Visita no disponible'; end if;
  select organization_id into member_org from public.organization_members where profile_id=auth.uid() and organization_id=v.organization_id and active and role in ('admin','guard') limit 1;
  if member_org is null then raise exception 'Acceso denegado'; end if;
  if p_decision='check_in' then
    if v.status='checked_in' then return v; end if;
    if v.status in ('checked_out','cancelled','denied','expired') then raise exception 'Estado no válido'; end if;
    if not p_allow_outside_window and now() not between v.starts_at-interval '15 min' and v.ends_at+interval '30 min' then raise exception 'Fuera de ventana'; end if;
    update public.visits set status='checked_in',checked_in_at=now() where id=v.id returning * into v;
    insert into public.access_events(organization_id,visit_id,location_id,actor_id,event_type) values(v.organization_id,v.id,v.location_id,auth.uid(),'check_in');
    insert into public.audit_logs(organization_id,actor_id,visit_id,event_type) values(v.organization_id,auth.uid(),v.id,'entry_approved');
  elsif p_decision='check_out' then
    if v.status='checked_out' then return v; end if;
    if v.status<>'checked_in' then raise exception 'Entrada no registrada'; end if;
    update public.visits set status='checked_out',checked_out_at=now() where id=v.id returning * into v;
    insert into public.access_events(organization_id,visit_id,location_id,actor_id,event_type) values(v.organization_id,v.id,v.location_id,auth.uid(),'check_out');
    insert into public.audit_logs(organization_id,actor_id,visit_id,event_type) values(v.organization_id,auth.uid(),v.id,'check_out');
  elsif p_decision='deny' then
    if nullif(trim(p_reason),'') is null then raise exception 'Motivo obligatorio'; end if;
    update public.visits set status='denied',denied_at=now(),denial_reason=p_reason where id=v.id returning * into v;
    insert into public.access_events(organization_id,visit_id,location_id,actor_id,event_type,reason) values(v.organization_id,v.id,v.location_id,auth.uid(),'denied',p_reason);
    insert into public.audit_logs(organization_id,actor_id,visit_id,event_type,metadata) values(v.organization_id,auth.uid(),v.id,'entry_denied',jsonb_build_object('reason',p_reason));
  else raise exception 'Decisión inválida'; end if;
  return v;
end $$;

create or replace function public.purge_expired_documents() returns integer language plpgsql security definer set search_path='' as $$
declare affected integer;
begin
  update public.visitor_documents set deleted_at=now(),storage_path='deleted/'||id where deleted_at is null and retention_expires_at<=now();
  get diagnostics affected=row_count;
  insert into public.audit_logs(organization_id,event_type,metadata)
    select organization_id,'document_deleted',jsonb_build_object('reason','retention_policy') from public.visitor_documents where deleted_at>=now()-interval '5 seconds';
  return affected;
end $$;

alter table public.organizations enable row level security; alter table public.profiles enable row level security;
alter table public.organization_members enable row level security; alter table public.locations enable row level security;
alter table public.visitors enable row level security; alter table public.visits enable row level security;
alter table public.visit_invitations enable row level security; alter table public.visitor_documents enable row level security;
alter table public.qr_tokens enable row level security; alter table public.access_events enable row level security;
alter table public.audit_logs enable row level security; alter table public.organization_settings enable row level security;
alter table public.notification_logs enable row level security;

create policy organizations_select on public.organizations for select using(public.is_member(id));
create policy organizations_admin_update on public.organizations for update using(public.has_role(id,array['superadmin','admin']::public.member_role[]));
create policy profiles_select on public.profiles for select using(id=auth.uid() or exists(select 1 from public.organization_members mine join public.organization_members theirs on theirs.organization_id=mine.organization_id where mine.profile_id=auth.uid() and theirs.profile_id=profiles.id and mine.active));
create policy profiles_self_update on public.profiles for update using(id=auth.uid());
create policy members_select on public.organization_members for select using(public.is_member(organization_id));
create policy members_admin_all on public.organization_members for all using(public.has_role(organization_id,array['superadmin','admin']::public.member_role[])) with check(public.has_role(organization_id,array['superadmin','admin']::public.member_role[]));
create policy locations_select on public.locations for select using(public.is_member(organization_id));
create policy locations_admin_all on public.locations for all using(public.has_role(organization_id,array['superadmin','admin']::public.member_role[])) with check(public.has_role(organization_id,array['superadmin','admin']::public.member_role[]));
create policy visitors_select on public.visitors for select using(public.has_role(organization_id,array['superadmin','admin','guard']::public.member_role[]) or exists(select 1 from public.visits v where v.visitor_id=visitors.id and v.host_id=auth.uid()));
create policy visitors_staff_write on public.visitors for all using(public.has_role(organization_id,array['superadmin','admin','guard','host']::public.member_role[])) with check(public.has_role(organization_id,array['superadmin','admin','guard','host']::public.member_role[]));
create policy visits_select on public.visits for select using(public.can_access_visit(visits));
create policy visits_insert on public.visits for insert with check(public.has_role(organization_id,array['superadmin','admin','guard','host']::public.member_role[]) and (host_id=auth.uid() or public.has_role(organization_id,array['superadmin','admin','guard']::public.member_role[])));
create policy visits_update on public.visits for update using(public.can_access_visit(visits)) with check(public.can_access_visit(visits));
create policy invitations_staff on public.visit_invitations for all using(public.has_role(organization_id,array['superadmin','admin','host']::public.member_role[]) and exists(select 1 from public.visits v where v.id=visit_id and public.can_access_visit(v))) with check(public.is_member(organization_id));
create policy documents_privileged on public.visitor_documents for select using(public.has_role(organization_id,array['superadmin','admin']::public.member_role[]) or (public.has_role(organization_id,array['guard']::public.member_role[]) and exists(select 1 from public.organization_settings s where s.organization_id=visitor_documents.organization_id and s.allow_document_preview_for_guards)));
create policy documents_staff_insert on public.visitor_documents for insert with check(public.has_role(organization_id,array['superadmin','admin','guard','host']::public.member_role[]));
create policy qr_staff_select on public.qr_tokens for select using(public.has_role(organization_id,array['superadmin','admin','guard']::public.member_role[]) or exists(select 1 from public.visits v where v.id=visit_id and v.host_id=auth.uid()));
create policy qr_admin_write on public.qr_tokens for all using(public.has_role(organization_id,array['superadmin','admin']::public.member_role[])) with check(public.has_role(organization_id,array['superadmin','admin']::public.member_role[]));
create policy access_events_select on public.access_events for select using(public.has_role(organization_id,array['superadmin','admin','guard']::public.member_role[]) or exists(select 1 from public.visits v where v.id=visit_id and v.host_id=auth.uid()));
create policy access_events_guard_insert on public.access_events for insert with check(public.has_role(organization_id,array['superadmin','admin','guard']::public.member_role[]) and actor_id=auth.uid());
create policy audit_select on public.audit_logs for select using(public.has_role(organization_id,array['superadmin','admin']::public.member_role[]));
create policy settings_select on public.organization_settings for select using(public.is_member(organization_id));
create policy settings_admin_write on public.organization_settings for all using(public.has_role(organization_id,array['superadmin','admin']::public.member_role[])) with check(public.has_role(organization_id,array['superadmin','admin']::public.member_role[]));
create policy notifications_select on public.notification_logs for select using(public.has_role(organization_id,array['superadmin','admin']::public.member_role[]) or exists(select 1 from public.visits v where v.id=visit_id and v.host_id=auth.uid()));

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('visitor-documents','visitor-documents',false,8388608,array['image/jpeg','image/png','image/webp']) on conflict(id) do update set public=false;
create policy document_storage_read on storage.objects for select using(bucket_id='visitor-documents' and public.has_role((storage.foldername(name))[1]::uuid,array['superadmin','admin']::public.member_role[]));
create policy document_storage_insert on storage.objects for insert with check(bucket_id='visitor-documents' and public.has_role((storage.foldername(name))[1]::uuid,array['superadmin','admin','guard','host']::public.member_role[]));
create policy document_storage_delete on storage.objects for delete using(bucket_id='visitor-documents' and public.has_role((storage.foldername(name))[1]::uuid,array['superadmin','admin']::public.member_role[]));

revoke all on function public.record_access_decision(uuid,text,text,boolean) from public;
grant execute on function public.record_access_decision(uuid,text,text,boolean) to authenticated;
revoke all on function public.purge_expired_documents() from public,anon,authenticated;
grant execute on function public.purge_expired_documents() to service_role;
