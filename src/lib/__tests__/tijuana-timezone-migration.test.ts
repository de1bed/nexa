import { readFileSync } from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { describe, expect, it } from "vitest";

const root = path.resolve(__dirname, "../../..");
const migration = readFileSync(
  path.join(root, "supabase/migrations/202611060039_tijuana_timezone.sql"),
  "utf8",
);

const org = "00000000-0000-0000-0000-0000000000a1";
const admin = "00000000-0000-0000-0000-0000000000b1";
const cdmxSite = "00000000-0000-0000-0000-0000000000e1";
const tijuanaSite = "00000000-0000-0000-0000-0000000000e2";

async function setup() {
  const db = new PGlite();
  await db.exec(`
    create schema if not exists auth;
    create role anon; create role authenticated;
    create or replace function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create type public.member_role as enum ('superadmin', 'admin', 'host', 'guard');
    create type public.visit_status as enum (
      'draft','invited','pre_registered','approved','checked_in','checked_out','denied','cancelled','expired');
    create type public.visit_origin as enum ('host_invitation','public_link','guard_manual');
    create table public.organization_members (
      organization_id uuid, profile_id uuid, role public.member_role, active boolean default true);
    create table public.locations (
      id uuid primary key, organization_id uuid, name text,
      timezone text not null default 'America/Mexico_City');
    create table public.visits (
      id uuid primary key, organization_id uuid, location_id uuid,
      status public.visit_status, origin public.visit_origin default 'host_invitation',
      starts_at timestamptz, ends_at timestamptz, checked_in_at timestamptz,
      created_at timestamptz default now());
    create table public.visit_invitations (id serial primary key, visit_id uuid, expires_at timestamptz);
    create table public.qr_tokens (
      id serial primary key, visit_id uuid, valid_from timestamptz,
      expires_at timestamptz, revoked_at timestamptz);
    create or replace function public.enforce_visit_update_permissions() returns trigger
    language plpgsql as $$ begin raise exception 'bloqueado'; end $$;
    create trigger enforce_visit_update_permissions before update on public.visits
      for each row execute function public.enforce_visit_update_permissions();

    insert into public.organization_members values ('${org}', '${admin}', 'admin', true);
    insert into public.locations values
      ('${cdmxSite}', '${org}', 'Planta', 'America/Mexico_City'),
      ('${tijuanaSite}', '${org}', 'Otra', 'America/Tijuana');
    -- Cita escrita a las 9:00 en la sede mal configurada.
    insert into public.visits (id, organization_id, location_id, status, starts_at, ends_at)
    values ('10000000-0000-0000-0000-000000000001', '${org}', '${cdmxSite}', 'invited',
      timestamptz '2026-11-10 09:00:00 America/Mexico_City',
      timestamptz '2026-11-10 10:00:00 America/Mexico_City');
    insert into public.qr_tokens (visit_id, valid_from, expires_at) values
      ('10000000-0000-0000-0000-000000000001',
       timestamptz '2026-11-10 08:45:00 America/Mexico_City',
       timestamptz '2026-11-11 09:00:00 America/Mexico_City');
    -- Entrada ya registrada: es un instante real, no se toca.
    insert into public.visits (id, organization_id, location_id, status, starts_at, ends_at, checked_in_at)
    values ('10000000-0000-0000-0000-000000000002', '${org}', '${cdmxSite}', 'checked_in',
      timestamptz '2026-11-05 09:00:00 America/Mexico_City',
      timestamptz '2026-11-05 10:00:00 America/Mexico_City',
      timestamptz '2026-11-05 17:03:00+00');
  `);
  await db.exec(migration);
  return db;
}

async function wallTime(db: PGlite, id: string) {
  const row = await db.query<{ start: string; finish: string }>(
    `select to_char(starts_at at time zone 'America/Tijuana', 'YYYY-MM-DD HH24:MI') as start,
            to_char(ends_at at time zone 'America/Tijuana', 'YYYY-MM-DD HH24:MI') as finish
     from public.visits where id = $1`,
    [id],
  );
  return row.rows[0];
}

describe("migración de la zona de Tijuana", () => {
  it("pasa la sede a Tijuana y la cita de las 9:00 sigue a las 9:00", async () => {
    const db = await setup();
    const site = await db.query<{ timezone: string }>(
      `select timezone from public.locations where id = '${cdmxSite}'`,
    );
    expect(site.rows[0]?.timezone).toBe("America/Tijuana");
    expect(await wallTime(db, "10000000-0000-0000-0000-000000000001")).toEqual({
      start: "2026-11-10 09:00",
      finish: "2026-11-10 10:00",
    });
    const token = await db.query<{ until: string }>(
      `select to_char(expires_at at time zone 'America/Tijuana', 'YYYY-MM-DD HH24:MI') as until
       from public.qr_tokens`,
    );
    expect(token.rows[0]?.until).toBe("2026-11-11 09:00");
  });

  it("no mueve una entrada que ya se registró", async () => {
    const db = await setup();
    const row = await db.query<{ at: string }>(
      `select checked_in_at::text as at from public.visits
       where id = '10000000-0000-0000-0000-000000000002'`,
    );
    expect(new Date(row.rows[0]!.at).toISOString()).toBe("2026-11-05T17:03:00.000Z");
  });

  it("la administración cambia la zona y la base reinterpreta las citas pendientes", async () => {
    const db = await setup();
    await db.exec(`
      insert into public.visits (id, organization_id, location_id, status, starts_at, ends_at)
      values ('10000000-0000-0000-0000-000000000003', '${org}', '${tijuanaSite}', 'invited',
        timestamptz '2026-11-12 14:00:00 America/Tijuana',
        timestamptz '2026-11-12 15:00:00 America/Tijuana');
      drop trigger enforce_visit_update_permissions on public.visits;
      select set_config('request.jwt.claim.sub', '${admin}', false);
      select public.set_location_timezone('${tijuanaSite}', 'America/Mexico_City');
    `);
    const row = await db.query<{ start: string }>(
      `select to_char(starts_at at time zone 'America/Mexico_City', 'HH24:MI') as start
       from public.visits where id = '10000000-0000-0000-0000-000000000003'`,
    );
    expect(row.rows[0]?.start).toBe("14:00");
    await expect(
      db.exec(`select public.set_location_timezone('${tijuanaSite}', 'Marte/Base')`),
    ).rejects.toThrow(/Zona horaria no válida/);
  });
});
