import { readFileSync } from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { describe, expect, it } from "vitest";

const root = path.resolve(__dirname, "../../..");
const migration = readFileSync(
  path.join(root, "supabase/migrations/202611030038_reusable_pass.sql"),
  "utf8",
);

const org = "00000000-0000-0000-0000-0000000000a1";
const guard = "00000000-0000-0000-0000-0000000000b1";
const host = "00000000-0000-0000-0000-0000000000c1";
const siteA = "00000000-0000-0000-0000-0000000000e1";
const siteB = "00000000-0000-0000-0000-0000000000e2";
const boothA = "00000000-0000-0000-0000-0000000000d1";

describe("pase reutilizable", () => {
  it("conserva el disparador cerrado y la regla en una sola función", () => {
    expect(migration).toMatch(/function public\.pass_is_reusable/i);
    expect(migration).toMatch(/security definer/i);
    expect(migration).toMatch(/set search_path = ''/);
    expect(migration).toContain("'check_in_booth_id','check_out_booth_id'");
    expect(migration).toContain("pass_is_reusable(old)");
    expect(migration).toContain(
      "revoke all on function public.enforce_visit_update_permissions() from public, anon, authenticated;",
    );
    expect(migration).toContain("coalesce(pass_valid_days, 1)");
  });

  it("entra y sale en una planta y vuelve a entrar en otra; el de un solo uso se cierra", async () => {
    const db = new PGlite();
    await db.exec(`
      create schema if not exists auth;
      create role anon;
      create role authenticated;
      create role service_role;
      create or replace function auth.uid() returns uuid
      language sql stable as $$
        select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
      $$;
      create or replace function auth.role() returns text
      language sql stable as $$
        select coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), 'anon')
      $$;
      create or replace function public.token_hash(p_token text)
      returns text language sql immutable as $$
        select encode(sha256(convert_to(p_token, 'UTF8')), 'hex')
      $$;

      create type public.member_role as enum ('superadmin', 'admin', 'host', 'guard');
      create type public.visit_status as enum (
        'draft', 'invited', 'pre_registered', 'approved',
        'checked_in', 'checked_out', 'denied', 'cancelled', 'expired'
      );
      create type public.access_event_type as enum (
        'qr_scanned', 'check_in', 'check_out', 'denied', 'manual_check_in'
      );

      create table public.profiles (
        id uuid primary key,
        full_name text not null,
        email text
      );
      create table public.organization_members (
        organization_id uuid not null,
        profile_id uuid not null,
        role public.member_role not null,
        active boolean not null default true
      );
      create table public.locations (
        id uuid primary key,
        organization_id uuid not null,
        name text not null
      );
      create table public.organization_settings (
        organization_id uuid primary key,
        early_entry_minutes integer,
        late_entry_minutes integer
      );
      create table public.booths (
        id uuid primary key,
        organization_id uuid not null,
        location_id uuid not null,
        name text not null,
        active boolean not null default true
      );
      create table public.visits (
        id uuid primary key,
        organization_id uuid not null,
        host_id uuid not null,
        location_id uuid not null,
        visitor_id uuid,
        status public.visit_status not null,
        purpose text not null default 'Visita',
        visitor_company text,
        vehicle_plate text,
        vehicle_declined boolean not null default false,
        visitor_notes text,
        access_requirements text,
        starts_at timestamptz not null,
        ends_at timestamptz not null,
        pass_valid_days integer not null default 1,
        all_locations boolean not null default false,
        checked_in_at timestamptz,
        checked_out_at timestamptz,
        denied_at timestamptz,
        denial_reason text,
        cancelled_at timestamptz,
        cancelled_by uuid,
        check_in_booth_id uuid,
        check_out_booth_id uuid,
        updated_at timestamptz
      );
      create table public.visit_access_locations (
        visit_id uuid not null,
        location_id uuid not null,
        primary key (visit_id, location_id)
      );
      create table public.visitors (
        id uuid primary key,
        full_name text,
        company text,
        phone text
      );
      create table public.visitor_documents (
        id uuid primary key,
        visit_id uuid not null,
        deleted_at timestamptz,
        document_type text
      );
      create table public.qr_tokens (
        id uuid primary key default gen_random_uuid(),
        organization_id uuid not null,
        visit_id uuid not null,
        token_hash text not null,
        token_hint text not null default '••••',
        valid_from timestamptz not null,
        expires_at timestamptz not null,
        revoked_at timestamptz
      );
      create table public.access_events (
        id uuid primary key default gen_random_uuid(),
        organization_id uuid not null,
        visit_id uuid not null,
        location_id uuid not null,
        booth_id uuid,
        actor_id uuid,
        event_type public.access_event_type not null,
        reason text,
        metadata jsonb
      );
      create table public.audit_logs (
        id uuid primary key default gen_random_uuid(),
        organization_id uuid not null,
        actor_id uuid,
        visit_id uuid,
        event_type text not null,
        metadata jsonb
      );

      create or replace function public.visit_valid_at_location(p_visit public.visits, p_location uuid)
      returns boolean language sql stable as $$
        select p_visit.all_locations
          or p_location = p_visit.location_id
          or exists (
            select 1 from public.visit_access_locations a
            where a.visit_id = p_visit.id and a.location_id = p_location
          )
      $$;
    `);

    await db.exec(migration);
    await db.exec(`
      create trigger enforce_visit_update_permissions
      before update on public.visits
      for each row execute function public.enforce_visit_update_permissions();

      insert into public.profiles (id, full_name, email) values
        ('${guard}', 'Caseta Norte', 'guardia@nexa.test'),
        ('${host}', 'Ana Anfitriona', 'ana@nexa.test');
      insert into public.organization_members (organization_id, profile_id, role, active)
      values ('${org}', '${guard}', 'guard', true);
      insert into public.locations (id, organization_id, name) values
        ('${siteA}', '${org}', 'Planta A'),
        ('${siteB}', '${org}', 'Planta B');
      insert into public.organization_settings (organization_id, early_entry_minutes, late_entry_minutes)
      values ('${org}', 15, 30);
      insert into public.booths (id, organization_id, location_id, name, active)
      values ('${boothA}', '${org}', '${siteA}', 'Peatonal', true);

      select set_config('request.jwt.claim.sub', '${guard}', false);
      select set_config('request.jwt.claim.role', 'authenticated', false);
    `);

    const first = "10000000-0000-0000-0000-000000000011";
    await insertVisit(db, first, "invited", true, 1);
    await db.exec(`
      insert into public.qr_tokens (organization_id, visit_id, token_hash, valid_from, expires_at)
      values (
        '${org}', '${first}', public.token_hash('pase-todas-las-sedes'),
        now() - interval '1 hour', now() + interval '8 hours'
      );
    `);

    await decide(db, first, "check_in", siteA, boothA);
    expect(await statusOf(db, first)).toBe("checked_in");
    expect(await boothOf(db, first)).toBe(boothA);

    await decide(db, first, "check_out", siteA, boothA);
    expect(await statusOf(db, first)).toBe("checked_out");
    expect(await revoked(db, first)).toBe(false);

    const resolved = await db.query<{ token_state: string }>(
      `select token_state from public.resolve_qr_token('pase-todas-las-sedes')`,
    );
    expect(resolved.rows[0]?.token_state).toBe("valid");

    await decide(db, first, "check_in", siteB, null);
    const back = await db.query<{
      status: string;
      checked_out_at: string | null;
    }>(
      `select status, checked_out_at from public.visits where id = '${first}'`,
    );
    expect(back.rows[0]?.status).toBe("checked_in");
    expect(back.rows[0]?.checked_out_at).toBeNull();

    const events = await db.query<{ event_type: string; location_id: string }>(
      `select event_type, location_id from public.access_events
       where visit_id = '${first}' order by event_type, location_id`,
    );
    expect(events.rows.filter((row) => row.event_type === "check_in")).toHaveLength(2);
    expect(events.rows.filter((row) => row.event_type === "check_out")).toHaveLength(1);
    expect(events.rows.map((row) => row.location_id).sort()).toEqual(
      [siteA, siteA, siteB].sort(),
    );

    await decide(db, first, "check_out", siteB, null);
    await decide(db, first, "check_in", siteA, boothA);
    expect(await statusOf(db, first)).toBe("checked_in");
    expect(await revoked(db, first)).toBe(false);
    const again = await db.query<{ event_type: string }>(
      `select event_type from public.access_events where visit_id = '${first}'`,
    );
    expect(again.rows.filter((row) => row.event_type === "check_in")).toHaveLength(3);
    expect(again.rows.filter((row) => row.event_type === "check_out")).toHaveLength(2);

    const once = "10000000-0000-0000-0000-000000000012";
    await insertVisit(db, once, "pre_registered", false, 1);
    await db.exec(`
      insert into public.qr_tokens (organization_id, visit_id, token_hash, valid_from, expires_at)
      values (
        '${org}', '${once}', public.token_hash('pase-un-solo-uso'),
        now() - interval '1 hour', now() + interval '8 hours'
      );
    `);
    await decide(db, once, "check_in", siteA, null);
    await decide(db, once, "check_out", siteA, null);
    expect(await revoked(db, once)).toBe(true);
    await expect(decide(db, once, "check_in", siteB, null)).rejects.toThrow(
      /cerrada o cancelada/,
    );
    expect(await statusOf(db, once)).toBe("checked_out");

    const listed = "10000000-0000-0000-0000-000000000013";
    await insertVisit(db, listed, "approved", false, 1);
    await db.exec(`
      insert into public.visit_access_locations (visit_id, location_id)
      values ('${listed}', '${siteB}');
      insert into public.qr_tokens (organization_id, visit_id, token_hash, valid_from, expires_at)
      values (
        '${org}', '${listed}', public.token_hash('pase-lista'),
        now() - interval '1 hour', now() + interval '8 hours'
      );
    `);
    await decide(db, listed, "check_in", siteA, null);
    await decide(db, listed, "check_out", siteA, null);
    expect(await revoked(db, listed)).toBe(false);

    await db.exec(`
      select set_config('request.jwt.claim.role', 'service_role', false);
    `);

    const week = "10000000-0000-0000-0000-000000000014";
    await insertVisit(db, week, "invited", false, 5);
    await db.exec(`
      update public.visits
      set starts_at = now() - interval '2 days',
          ends_at = now() - interval '2 days' + interval '2 hours'
      where id = '${week}';
    `);
    const expired = await db.query<{ expired_count: number }>(
      `select public.expire_stale_visits() as expired_count`,
    );
    expect(Number(expired.rows[0]?.expired_count ?? 0)).toBe(0);
    expect(await statusOf(db, week)).toBe("invited");

    const stale = "10000000-0000-0000-0000-000000000015";
    await insertVisit(db, stale, "invited", false, 1);
    await db.exec(`
      update public.visits
      set starts_at = now() - interval '3 days',
          ends_at = now() - interval '3 days' + interval '1 hour'
      where id = '${stale}';
    `);
    await db.exec(`select public.expire_stale_visits()`);
    expect(await statusOf(db, stale)).toBe("expired");
  });
});

async function insertVisit(
  db: PGlite,
  id: string,
  status: string,
  allLocations: boolean,
  days: number,
) {
  await db.exec(`
    insert into public.visits (
      id, organization_id, host_id, location_id, status,
      starts_at, ends_at, all_locations, pass_valid_days, purpose
    ) values (
      '${id}', '${org}', '${host}', '${siteA}', '${status}',
      now() - interval '20 minutes', now() + interval '2 hours',
      ${allLocations}, ${days}, 'Visita'
    );
  `);
}

function decide(
  db: PGlite,
  id: string,
  decision: "check_in" | "check_out",
  location: string,
  booth: string | null,
) {
  const boothSql = booth ? `'${booth}'` : "null";
  return db.exec(`
    select public.record_access_decision(
      '${id}', '${decision}', null, false, '${location}', ${boothSql}
    );
  `);
}

async function statusOf(db: PGlite, id: string) {
  const result = await db.query<{ status: string }>(
    `select status from public.visits where id = '${id}'`,
  );
  return result.rows[0]?.status;
}

async function boothOf(db: PGlite, id: string) {
  const result = await db.query<{ check_in_booth_id: string }>(
    `select check_in_booth_id from public.visits where id = '${id}'`,
  );
  return result.rows[0]?.check_in_booth_id;
}

async function revoked(db: PGlite, id: string) {
  const result = await db.query<{ revoked_at: string | null }>(
    `select revoked_at from public.qr_tokens where visit_id = '${id}'`,
  );
  return Boolean(result.rows[0]?.revoked_at);
}
