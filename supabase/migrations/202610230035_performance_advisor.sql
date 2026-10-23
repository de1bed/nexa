-- Performance advisor (project ogrdzqrvbrpgbtkmhuus):
-- 1) Cover unindexed foreign keys so deletes/joins do not seq-scan.
-- 2) Wrap auth.uid() in (select ...) so RLS init plans run once per statement.
-- Leaked-password protection is an Auth dashboard toggle, not SQL.

create index if not exists access_events_actor_id_idx
  on public.access_events (actor_id);
create index if not exists access_events_booth_id_idx
  on public.access_events (booth_id);
create index if not exists access_events_location_id_idx
  on public.access_events (location_id);
create index if not exists access_events_organization_id_idx
  on public.access_events (organization_id);

create index if not exists access_requests_department_id_idx
  on public.access_requests (department_id);
create index if not exists access_requests_profile_id_idx
  on public.access_requests (profile_id);
create index if not exists access_requests_reviewed_by_idx
  on public.access_requests (reviewed_by);

create index if not exists audit_logs_actor_id_idx
  on public.audit_logs (actor_id);
create index if not exists audit_logs_visit_id_idx
  on public.audit_logs (visit_id);

create index if not exists guard_access_codes_profile_id_idx
  on public.guard_access_codes (profile_id);

create index if not exists notification_logs_organization_id_idx
  on public.notification_logs (organization_id);
create index if not exists notification_logs_visit_id_idx
  on public.notification_logs (visit_id);

create index if not exists organization_join_codes_created_by_idx
  on public.organization_join_codes (created_by);

create index if not exists organization_members_default_booth_id_idx
  on public.organization_members (default_booth_id);
create index if not exists organization_members_default_location_id_idx
  on public.organization_members (default_location_id);
create index if not exists organization_members_department_id_idx
  on public.organization_members (department_id);
create index if not exists organization_members_invited_by_idx
  on public.organization_members (invited_by);
create index if not exists organization_members_profile_id_idx
  on public.organization_members (profile_id);

create index if not exists organization_requirements_created_by_idx
  on public.organization_requirements (created_by);

create index if not exists platform_events_actor_id_idx
  on public.platform_events (actor_id);
create index if not exists platform_events_organization_id_idx
  on public.platform_events (organization_id);

create index if not exists platform_payments_recorded_by_idx
  on public.platform_payments (recorded_by);

create index if not exists qr_tokens_organization_id_idx
  on public.qr_tokens (organization_id);
create index if not exists qr_tokens_visit_id_idx
  on public.qr_tokens (visit_id);

create index if not exists station_users_booth_id_idx
  on public.station_users (booth_id);

create index if not exists team_invitations_invited_by_idx
  on public.team_invitations (invited_by);
create index if not exists team_invitations_profile_id_idx
  on public.team_invitations (profile_id);

create index if not exists visit_access_locations_organization_id_idx
  on public.visit_access_locations (organization_id);

create index if not exists visit_attachments_organization_id_idx
  on public.visit_attachments (organization_id);
create index if not exists visit_attachments_requirement_id_idx
  on public.visit_attachments (requirement_id);

create index if not exists visit_invitations_organization_id_idx
  on public.visit_invitations (organization_id);

create index if not exists visitor_documents_organization_id_idx
  on public.visitor_documents (organization_id);
create index if not exists visitor_documents_visit_id_idx
  on public.visitor_documents (visit_id);
create index if not exists visitor_documents_visitor_id_idx
  on public.visitor_documents (visitor_id);

create index if not exists visits_cancelled_by_idx
  on public.visits (cancelled_by);
create index if not exists visits_check_out_booth_id_idx
  on public.visits (check_out_booth_id);
create index if not exists visits_created_by_idx
  on public.visits (created_by);
create index if not exists visits_location_id_idx
  on public.visits (location_id);
create index if not exists visits_visitor_id_idx
  on public.visits (visitor_id);

create index if not exists walkin_points_created_by_idx
  on public.walkin_points (created_by);

drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select using (
    id = (select auth.uid())
    or exists (
      select 1
      from public.organization_members mine
      join public.organization_members theirs
        on theirs.organization_id = mine.organization_id
      where mine.profile_id = (select auth.uid())
        and theirs.profile_id = profiles.id
        and mine.active
    )
  );

drop policy if exists profiles_self_update on public.profiles;
create policy profiles_self_update on public.profiles
  for update using (id = (select auth.uid()));

drop policy if exists visits_insert on public.visits;
create policy visits_insert on public.visits
  for insert with check (
    public.has_role(
      organization_id,
      array['superadmin','admin','guard','host']::public.member_role[]
    )
    and (
      host_id = (select auth.uid())
      or public.has_role(
        organization_id,
        array['superadmin','admin','guard']::public.member_role[]
      )
    )
  );

drop policy if exists qr_staff_select on public.qr_tokens;
create policy qr_staff_select on public.qr_tokens
  for select using (
    public.has_role(
      organization_id,
      array['superadmin','admin','guard']::public.member_role[]
    )
    or exists (
      select 1 from public.visits v
      where v.id = qr_tokens.visit_id
        and v.host_id = (select auth.uid())
    )
  );

drop policy if exists access_events_select on public.access_events;
create policy access_events_select on public.access_events
  for select using (
    public.has_role(
      organization_id,
      array['superadmin','admin','guard']::public.member_role[]
    )
    or exists (
      select 1 from public.visits v
      where v.id = access_events.visit_id
        and v.host_id = (select auth.uid())
    )
  );

drop policy if exists access_events_guard_insert on public.access_events;
create policy access_events_guard_insert on public.access_events
  for insert with check (
    public.has_role(
      organization_id,
      array['superadmin','admin','guard']::public.member_role[]
    )
    and actor_id = (select auth.uid())
  );

drop policy if exists notifications_select on public.notification_logs;
create policy notifications_select on public.notification_logs
  for select using (
    public.has_role(
      organization_id,
      array['superadmin','admin']::public.member_role[]
    )
    or exists (
      select 1 from public.visits v
      where v.id = notification_logs.visit_id
        and v.host_id = (select auth.uid())
    )
  );

drop policy if exists invitations_staff on public.visit_invitations;
create policy invitations_staff on public.visit_invitations
  for all
  using (
    public.has_role(
      organization_id,
      array['superadmin','admin']::public.member_role[]
    )
    or exists (
      select 1 from public.visits visit
      where visit.id = visit_invitations.visit_id
        and visit.host_id = (select auth.uid())
        and visit.organization_id = visit.organization_id
    )
  )
  with check (
    public.has_role(
      organization_id,
      array['superadmin','admin']::public.member_role[]
    )
    or exists (
      select 1 from public.visits visit
      where visit.id = visit_invitations.visit_id
        and visit.host_id = (select auth.uid())
        and visit.organization_id = visit.organization_id
    )
  );

drop policy if exists visitors_select on public.visitors;
create policy visitors_select on public.visitors
  for select using (
    public.has_role(
      organization_id,
      array['superadmin','admin','guard']::public.member_role[]
    )
    or exists (
      select 1 from public.visits v
      where v.visitor_id = visitors.id
        and v.host_id = (select auth.uid())
    )
  );

drop policy if exists documents_host_own on public.visitor_documents;
create policy documents_host_own on public.visitor_documents
  for select using (
    exists (
      select 1 from public.visits v
      where v.id = visitor_documents.visit_id
        and v.organization_id = visitor_documents.organization_id
        and v.host_id = (select auth.uid())
        and public.has_role(
          v.organization_id,
          array['host']::public.member_role[]
        )
    )
  );

drop policy if exists access_requests_select on public.access_requests;
create policy access_requests_select on public.access_requests
  for select using (
    profile_id = (select auth.uid())
    or public.has_role(
      organization_id,
      array['superadmin','admin']::public.member_role[]
    )
  );

drop policy if exists visit_access_locations_write on public.visit_access_locations;
create policy visit_access_locations_write on public.visit_access_locations
  for all
  using (
    public.has_role(
      organization_id,
      array['superadmin','admin']::public.member_role[]
    )
    or exists (
      select 1 from public.visits v
      where v.id = visit_access_locations.visit_id
        and v.host_id = (select auth.uid())
        and v.organization_id = visit_access_locations.organization_id
    )
  )
  with check (
    public.has_role(
      organization_id,
      array['superadmin','admin']::public.member_role[]
    )
    or exists (
      select 1 from public.visits v
      where v.id = visit_access_locations.visit_id
        and v.host_id = (select auth.uid())
        and v.organization_id = visit_access_locations.organization_id
    )
  );

drop policy if exists visit_attachments_staff_write on public.visit_attachments;
create policy visit_attachments_staff_write on public.visit_attachments
  for all
  using (
    public.has_role(
      organization_id,
      array['superadmin','admin']::public.member_role[]
    )
    or exists (
      select 1 from public.visits v
      where v.id = visit_attachments.visit_id
        and v.host_id = (select auth.uid())
        and v.organization_id = visit_attachments.organization_id
    )
  )
  with check (
    public.has_role(
      organization_id,
      array['superadmin','admin']::public.member_role[]
    )
    or exists (
      select 1 from public.visits v
      where v.id = visit_attachments.visit_id
        and v.host_id = (select auth.uid())
        and v.organization_id = visit_attachments.organization_id
    )
  );
