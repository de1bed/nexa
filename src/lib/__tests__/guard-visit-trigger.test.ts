import { readFileSync } from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { describe, expect, it } from "vitest";

const root = path.resolve(__dirname, "../../..");
const migration = readFileSync(
  path.join(root, "supabase/migrations/202611020037_guard_booth_columns.sql"),
  "utf8",
);
const sohnen = readFileSync(
  path.join(
    root,
    "supabase/migrations/202610260036_sohnen_tijuana_schedule.sql",
  ),
  "utf8",
);

const orgId = "00000000-0000-0000-0000-0000000000a1";
const guardId = "00000000-0000-0000-0000-0000000000b1";
const hostId = "00000000-0000-0000-0000-0000000000c1";
const boothIn = "00000000-0000-0000-0000-0000000000d1";
const boothOut = "00000000-0000-0000-0000-0000000000d2";
const locationId = "00000000-0000-0000-0000-0000000000e1";
const otherLocation = "00000000-0000-0000-0000-0000000000e2";

describe("migración de casetas del guardia", () => {
  it("deja el disparador de Sohnen habilitado al final", () => {
    const disableAt = sohnen.lastIndexOf(
      "disable trigger enforce_visit_update_permissions",
    );
    const enableAt = sohnen.lastIndexOf(
      "enable trigger enforce_visit_update_permissions",
    );
    expect(disableAt).toBeGreaterThan(-1);
    expect(enableAt).toBeGreaterThan(disableAt);
    expect(sohnen.trimEnd().endsWith(
      "alter table public.visits enable trigger enforce_visit_update_permissions;",
    )).toBe(true);
  });

  it("conserva security definer, search_path vacío y revoca execute", () => {
    expect(migration).toMatch(/security definer/i);
    expect(migration).toMatch(/set search_path = ''/);
    expect(migration).toContain("'check_in_booth_id','check_out_booth_id'");
    expect(migration).toContain(
      "revoke all on function public.enforce_visit_update_permissions() from public, anon, authenticated;",
    );
    expect(migration).not.toMatch(/'location_id'/);
  });
});

describe("enforce_visit_update_permissions para guardia", () => {
  it("permite entrada y salida con caseta y sin caseta, y nada más", async () => {
    const db = new PGlite();
    await db.exec(`
      create schema if not exists auth;
      create role anon;
      create role authenticated;
      create or replace function auth.uid() returns uuid
      language sql stable as $$
        select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
      $$;
      create or replace function auth.role() returns text
      language sql stable as $$
        select coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), 'anon')
      $$;

      create type public.member_role as enum ('superadmin', 'admin', 'host', 'guard');
      create type public.visit_status as enum (
        'draft', 'invited', 'pre_registered', 'approved',
        'checked_in', 'checked_out', 'denied', 'cancelled', 'expired'
      );
      create table public.organization_members (
        organization_id uuid not null,
        profile_id uuid not null,
        role public.member_role not null,
        active boolean not null default true
      );
      create table public.visits (
        id uuid primary key,
        organization_id uuid not null,
        host_id uuid not null,
        location_id uuid,
        status public.visit_status not null,
        checked_in_at timestamptz,
        checked_out_at timestamptz,
        denied_at timestamptz,
        denial_reason text,
        cancelled_at timestamptz,
        cancelled_by uuid,
        check_in_booth_id uuid,
        check_out_booth_id uuid,
        visitor_company text,
        updated_at timestamptz
      );
    `);
    await db.exec(migration);
    await db.exec(`
      create trigger enforce_visit_update_permissions
      before update on public.visits
      for each row execute function public.enforce_visit_update_permissions();

      insert into public.organization_members (organization_id, profile_id, role, active)
      values ('${orgId}', '${guardId}', 'guard', true);

      select set_config('request.jwt.claim.sub', '${guardId}', false);
      select set_config('request.jwt.claim.role', 'authenticated', false);
    `);

    const visit = "10000000-0000-0000-0000-000000000001";
    await insertVisit(db, visit, "invited");

    await db.exec(`
      update public.visits
      set status = 'checked_in', checked_in_at = now()
      where id = '${visit}';
    `);
    expect(await statusOf(db, visit)).toBe("checked_in");

    await db.exec(`
      update public.visits
      set status = 'checked_out', checked_out_at = now()
      where id = '${visit}';
    `);
    expect(await statusOf(db, visit)).toBe("checked_out");

    const withBooth = "10000000-0000-0000-0000-000000000002";
    await insertVisit(db, withBooth, "pre_registered");
    await db.exec(`
      update public.visits
      set status = 'checked_in',
          checked_in_at = now(),
          check_in_booth_id = '${boothIn}'
      where id = '${withBooth}';
    `);
    const entered = await db.query<{
      status: string;
      check_in_booth_id: string;
    }>(`select status, check_in_booth_id from public.visits where id = '${withBooth}'`);
    expect(entered.rows[0]?.status).toBe("checked_in");
    expect(entered.rows[0]?.check_in_booth_id).toBe(boothIn);

    await db.exec(`
      update public.visits
      set status = 'checked_out',
          checked_out_at = now(),
          check_out_booth_id = '${boothOut}'
      where id = '${withBooth}';
    `);
    const left = await db.query<{
      status: string;
      check_out_booth_id: string;
    }>(`select status, check_out_booth_id from public.visits where id = '${withBooth}'`);
    expect(left.rows[0]?.status).toBe("checked_out");
    expect(left.rows[0]?.check_out_booth_id).toBe(boothOut);

    const denied = "10000000-0000-0000-0000-000000000003";
    await insertVisit(db, denied, "approved");
    await db.exec(`
      update public.visits
      set status = 'denied', denied_at = now(), denial_reason = 'Sin cita'
      where id = '${denied}';
    `);
    expect(await statusOf(db, denied)).toBe("denied");

    const blocked = "10000000-0000-0000-0000-000000000004";
    await insertVisit(db, blocked, "invited");
    await expect(
      db.exec(`
        update public.visits
        set status = 'checked_in',
            checked_in_at = now(),
            check_in_booth_id = '${boothIn}',
            location_id = '${otherLocation}'
        where id = '${blocked}';
      `),
    ).rejects.toThrow(/Actualización no permitida para guardia/);
    expect(await statusOf(db, blocked)).toBe("invited");

    await expect(
      db.exec(`
        update public.visits
        set visitor_company = 'Otra'
        where id = '${blocked}';
      `),
    ).rejects.toThrow(/Actualización no permitida para guardia/);
  });
});

async function insertVisit(db: PGlite, id: string, status: string) {
  await db.exec(`
    insert into public.visits (
      id, organization_id, host_id, location_id, status, visitor_company
    ) values (
      '${id}', '${orgId}', '${hostId}', '${locationId}', '${status}', 'Acme'
    );
  `);
}

async function statusOf(db: PGlite, id: string) {
  const result = await db.query<{ status: string }>(
    `select status from public.visits where id = '${id}'`,
  );
  return result.rows[0]?.status;
}
