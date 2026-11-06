import { readFileSync } from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { beforeEach, describe, expect, it } from "vitest";

/**
 * Recorre en Postgres real (PGlite) lo que hace la tableta de la caseta:
 * record_access_decision como guardia, con el disparador de permisos activo.
 * Cubre las pruebas de la reunión de planta:
 *  - escanear primero en la tableta, sin pasar por la computadora;
 *  - entrar y salir en planta 1 y volver a entrar en planta 2 con el mismo QR;
 *  - varias casetas en la misma sede;
 *  - y las negativas: QR de otra sede, QR de un solo uso ya usado.
 */

const root = path.resolve(__dirname, "../../..");
const latestMigrations = readdirMigrations();

function readdirMigrations() {
  const dir = path.join(root, "supabase/migrations");
  return {
    validAt: extractFunction(
      readFileSync(path.join(dir, "202610060026_multi_location_pass.sql"), "utf8"),
      "visit_valid_at_location",
    ),
    reusable: readFileSync(path.join(dir, "202611030038_reusable_pass.sql"), "utf8"),
  };
}

/** Saca un `create or replace function public.<name>` completo de un archivo. */
function extractFunction(sql: string, name: string) {
  const start = sql.indexOf(`create or replace function public.${name}`);
  if (start < 0) throw new Error(`No encontré ${name}`);
  const end = sql.indexOf("$fn$;", sql.indexOf("$fn$", start) + 4);
  return sql.slice(start, end + 5);
}

const org = "00000000-0000-0000-0000-0000000000a1";
const guard = "00000000-0000-0000-0000-0000000000b1";
const host = "00000000-0000-0000-0000-0000000000c1";
const plant1 = "00000000-0000-0000-0000-0000000000e1";
const plant2 = "00000000-0000-0000-0000-0000000000e2";
const plant3 = "00000000-0000-0000-0000-0000000000e3";
const pedestrian = "00000000-0000-0000-0000-0000000000d1";
const vehicles = "00000000-0000-0000-0000-0000000000d2";
const plant2Booth = "00000000-0000-0000-0000-0000000000d3";
const plant3Booth = "00000000-0000-0000-0000-0000000000d4";

let db: PGlite;

beforeEach(async () => {
  db = new PGlite();
  await db.exec(`
    create schema if not exists auth;
    create role anon;
    create role authenticated;
    create role service_role;
    create or replace function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
    $$;
    create or replace function auth.role() returns text language sql stable as $$
      select coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), 'anon')
    $$;

    create type public.member_role as enum ('superadmin', 'admin', 'host', 'guard');
    create type public.visit_status as enum (
      'draft', 'invited', 'pre_registered', 'approved',
      'checked_in', 'checked_out', 'denied', 'cancelled', 'expired'
    );
    create table public.organization_members (
      organization_id uuid not null, profile_id uuid not null,
      role public.member_role not null, active boolean not null default true
    );
    create table public.profiles (id uuid primary key, full_name text);
    create table public.locations (id uuid primary key, organization_id uuid not null, name text);
    create table public.booths (
      id uuid primary key, organization_id uuid not null, location_id uuid not null,
      name text not null, active boolean not null default true
    );
    create table public.organization_settings (
      organization_id uuid primary key, early_entry_minutes int, late_entry_minutes int
    );
    create table public.visits (
      id uuid primary key, organization_id uuid not null, host_id uuid not null,
      location_id uuid, status public.visit_status not null,
      starts_at timestamptz not null, ends_at timestamptz not null,
      pass_valid_days int default 1, all_locations boolean default false,
      checked_in_at timestamptz, checked_out_at timestamptz,
      denied_at timestamptz, denial_reason text,
      cancelled_at timestamptz, cancelled_by uuid,
      check_in_booth_id uuid, check_out_booth_id uuid,
      visitor_company text, updated_at timestamptz
    );
    create table public.visit_access_locations (visit_id uuid, location_id uuid);
    create table public.qr_tokens (
      id serial primary key, organization_id uuid, visit_id uuid, token_hash text,
      valid_from timestamptz default now(), expires_at timestamptz, revoked_at timestamptz
    );
    create table public.access_events (
      id serial primary key, organization_id uuid, visit_id uuid, location_id uuid,
      booth_id uuid, actor_id uuid, event_type text, reason text, metadata jsonb
    );
    create table public.audit_logs (
      id serial primary key, organization_id uuid, actor_id uuid, visit_id uuid,
      event_type text, metadata jsonb
    );
    create table public.visitors (id uuid primary key, full_name text, company text, phone text);
    create table public.visitor_documents (
      visit_id uuid, deleted_at timestamptz, document_type text
    );
    create or replace function public.token_hash(p_token text) returns text
    language sql immutable as $$ select md5(p_token) $$;
  `);
  await db.exec(latestMigrations.validAt);
  await db.exec(latestMigrations.reusable);
  await db.exec(`
    create trigger enforce_visit_update_permissions
    before update on public.visits
    for each row execute function public.enforce_visit_update_permissions();

    insert into public.organization_members values ('${org}', '${guard}', 'guard', true);
    insert into public.profiles values ('${guard}', 'Raúl'), ('${host}', 'Ana');
    insert into public.locations values
      ('${plant1}', '${org}', 'Planta 1'),
      ('${plant2}', '${org}', 'Planta 2'),
      ('${plant3}', '${org}', 'Planta 3');
    insert into public.booths values
      ('${pedestrian}', '${org}', '${plant1}', 'Peatonal', true),
      ('${vehicles}', '${org}', '${plant1}', 'Vehicular', true),
      ('${plant2Booth}', '${org}', '${plant2}', 'Caseta P2', true),
      ('${plant3Booth}', '${org}', '${plant3}', 'Caseta P3', true);

    select set_config('request.jwt.claim.sub', '${guard}', false);
    select set_config('request.jwt.claim.role', 'authenticated', false);
  `);
});

async function visit(
  id: string,
  options: { allLocations?: boolean; extra?: string[]; status?: string } = {},
) {
  await db.exec(`
    insert into public.visits (
      id, organization_id, host_id, location_id, status, starts_at, ends_at, all_locations
    ) values (
      '${id}', '${org}', '${host}', '${plant1}', '${options.status ?? "pre_registered"}',
      now() - interval '5 minutes', now() + interval '2 hours', ${options.allLocations ? "true" : "false"}
    );
    insert into public.qr_tokens (organization_id, visit_id, token_hash, expires_at)
    values ('${org}', '${id}', md5('${id}'), now() + interval '1 day');
  `);
  for (const location of options.extra ?? [])
    await db.exec(
      `insert into public.visit_access_locations values ('${id}', '${location}')`,
    );
}

async function decide(id: string, decision: string, location: string, booth?: string) {
  await db.query(
    `select status from public.record_access_decision($1, $2, null, false, $3, $4)`,
    [id, decision, location, booth ?? null],
  );
  const row = await db.query<{ status: string }>(
    `select status from public.visits where id = $1`,
    [id],
  );
  return row.rows[0]?.status;
}

async function revoked(id: string) {
  const row = await db.query<{ revoked: boolean }>(
    `select bool_or(revoked_at is not null) as revoked from public.qr_tokens where visit_id = $1`,
    [id],
  );
  return row.rows[0]?.revoked;
}

describe("tableta de caseta, de punta a punta", () => {
  it("el guardia registra la entrada primero en la tableta, sin la computadora", async () => {
    const id = "10000000-0000-0000-0000-000000000001";
    await visit(id);
    expect(await decide(id, "check_in", plant1, pedestrian)).toBe("checked_in");
    expect(await decide(id, "check_out", plant1, vehicles)).toBe("checked_out");
  });

  it("entra y sale en planta 1 y vuelve a entrar en planta 2 con el mismo QR", async () => {
    const id = "10000000-0000-0000-0000-000000000002";
    await visit(id, { extra: [plant2] });
    expect(await decide(id, "check_in", plant1, pedestrian)).toBe("checked_in");
    expect(await decide(id, "check_out", plant1, pedestrian)).toBe("checked_out");
    expect(await revoked(id)).toBe(false);
    expect(await decide(id, "check_in", plant2, plant2Booth)).toBe("checked_in");
    expect(await decide(id, "check_out", plant2, plant2Booth)).toBe("checked_out");
  });

  it("un pase de todas las sedes sirve en cualquier planta", async () => {
    const id = "10000000-0000-0000-0000-000000000003";
    await visit(id, { allLocations: true });
    await decide(id, "check_in", plant1, vehicles);
    await decide(id, "check_out", plant1, vehicles);
    expect(await decide(id, "check_in", plant3, plant3Booth)).toBe("checked_in");
  });

  it("cada caseta de la misma sede registra por su lado", async () => {
    const id = "10000000-0000-0000-0000-000000000004";
    await visit(id, { allLocations: true });
    await decide(id, "check_in", plant1, pedestrian);
    await decide(id, "check_out", plant1, vehicles);
    const events = await db.query<{ event_type: string; booth_id: string }>(
      `select event_type, booth_id from public.access_events where visit_id = $1 order by id`,
      [id],
    );
    expect(events.rows).toEqual([
      { event_type: "check_in", booth_id: pedestrian },
      { event_type: "check_out", booth_id: vehicles },
    ]);
  });

  it("con varias casetas en la sede pide elegir una para la entrada", async () => {
    const id = "10000000-0000-0000-0000-000000000005";
    await visit(id);
    await expect(decide(id, "check_in", plant1)).rejects.toThrow(/Elige la caseta/);
  });

  it("negativa: el QR de una sola sede no abre otra planta", async () => {
    const id = "10000000-0000-0000-0000-000000000006";
    await visit(id);
    await expect(decide(id, "check_in", plant2, plant2Booth)).rejects.toThrow(
      /no es válido en esta sede/,
    );
  });

  it("negativa: el QR de un solo uso queda cerrado al salir", async () => {
    const id = "10000000-0000-0000-0000-000000000007";
    await visit(id);
    await decide(id, "check_in", plant1, pedestrian);
    await decide(id, "check_out", plant1, pedestrian);
    expect(await revoked(id)).toBe(true);
    await expect(decide(id, "check_in", plant1, pedestrian)).rejects.toThrow(
      /ya fue cerrada/,
    );
  });

  it("negativa: un pase con sedes extra no abre una planta que no está en la lista", async () => {
    const id = "10000000-0000-0000-0000-000000000008";
    await visit(id, { extra: [plant2] });
    await expect(decide(id, "check_in", plant3, plant3Booth)).rejects.toThrow(
      /no es válido en esta sede/,
    );
  });

  it("negativa: quien no es guardia ni administrador no registra accesos", async () => {
    const id = "10000000-0000-0000-0000-000000000009";
    await visit(id);
    await db.exec(
      `insert into public.organization_members values ('${org}', '${host}', 'host', true);
       select set_config('request.jwt.claim.sub', '${host}', false);`,
    );
    await expect(decide(id, "check_in", plant1, pedestrian)).rejects.toThrow(
      /Acceso denegado/,
    );
  });

  it("negativa: una caseta desactivada no registra", async () => {
    const id = "10000000-0000-0000-0000-000000000010";
    await visit(id);
    await db.exec(`update public.booths set active = false where id = '${vehicles}'`);
    await expect(decide(id, "check_in", plant1, vehicles)).rejects.toThrow(
      /caseta no está disponible/,
    );
  });
});
