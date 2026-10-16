import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { requireApiContext } from "@/lib/server/session";
import { createAdminClient } from "@/lib/server/supabase-admin";
import { writeAudit } from "@/lib/server/audit";
import {
  formatCompanyCode,
  isStationUsername,
  normalizeStationUsername,
} from "@/lib/station-access";

export const dynamic = "force-dynamic";

const ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

function generateCompanyCode() {
  const bytes = randomBytes(6);
  let body = "";
  for (const byte of bytes) body += ALPHABET[byte % ALPHABET.length];
  return `NEXA-${body}`;
}

const schema = z.object({
  username: z.string().trim().min(3).max(32),
  boothId: z.uuid(),
});

export async function GET() {
  const guard = await requireApiContext(["superadmin", "admin"]);
  if (!guard.ok)
    return NextResponse.json({ error: guard.error }, { status: guard.status });

  const admin = createAdminClient();
  const { data: organization, error } = await admin
    .from("organizations")
    .select("id, tablet_company_code")
    .eq("id", guard.context.organizationId)
    .single();
  if (error || !organization)
    return NextResponse.json(
      { error: "No fue posible leer la clave de empresa." },
      { status: 500 },
    );

  let companyCode = organization.tablet_company_code as string | null;
  if (!companyCode) {
    companyCode = generateCompanyCode();
    const { error: updateError } = await admin
      .from("organizations")
      .update({ tablet_company_code: companyCode })
      .eq("id", organization.id);
    if (updateError)
      return NextResponse.json(
        { error: "No fue posible preparar la clave de empresa." },
        { status: 500 },
      );
  }

  const { data: stations, error: stationError } = await admin
    .from("station_users")
    .select("id, username, booth_id, active, booth:booths(name)")
    .eq("organization_id", organization.id)
    .order("created_at", { ascending: true });
  if (stationError)
    return NextResponse.json(
      { error: "No fue posible cargar los usuarios de tableta." },
      { status: 500 },
    );

  return NextResponse.json({
    companyCode: formatCompanyCode(companyCode),
    stations: (stations ?? []).map((row) => {
      const booth = row.booth as unknown as { name?: string } | null;
      return {
        id: row.id as string,
        username: row.username as string,
        boothId: (row.booth_id as string | null) ?? "",
        boothName: booth?.name ?? "",
        active: Boolean(row.active),
      };
    }),
  });
}

export async function POST(request: Request) {
  const guard = await requireApiContext(["superadmin", "admin"]);
  if (!guard.ok)
    return NextResponse.json({ error: guard.error }, { status: guard.status });

  try {
    const input = schema.parse(await request.json());
    if (!isStationUsername(input.username))
      return NextResponse.json(
        { error: "El usuario usa letras, números y un punto o guion. Mínimo 3." },
        { status: 400 },
      );

    const admin = createAdminClient();
    const username = normalizeStationUsername(input.username);
    const { data: booth } = await admin
      .from("booths")
      .select("id, name")
      .eq("id", input.boothId)
      .eq("organization_id", guard.context.organizationId)
      .eq("active", true)
      .maybeSingle();
    if (!booth)
      return NextResponse.json(
        { error: "Esa caseta no está disponible." },
        { status: 400 },
      );

    const { data: taken } = await admin
      .from("station_users")
      .select("username")
      .eq("organization_id", guard.context.organizationId)
      .eq("booth_id", booth.id)
      .eq("active", true)
      .maybeSingle();
    if (taken?.username)
      return NextResponse.json(
        { error: `Esa caseta ya tiene el usuario ${taken.username}.` },
        { status: 409 },
      );

    const { data: created, error } = await admin
      .from("station_users")
      .insert({
        organization_id: guard.context.organizationId,
        username,
        booth_id: booth.id,
      })
      .select("id, username, booth_id")
      .single();
    if (error)
      return NextResponse.json(
        { error: "Ese usuario ya existe en la empresa." },
        { status: 409 },
      );

    await writeAudit({
      organizationId: guard.context.organizationId,
      actorId: guard.context.userId,
      eventType: "station_user_created",
      metadata: { username, booth_id: booth.id },
    });

    return NextResponse.json(
      {
        station: {
          id: created.id as string,
          username: created.username as string,
          boothId: created.booth_id as string,
          boothName: booth.name as string,
          active: true,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof z.ZodError)
      return NextResponse.json({ error: "Revisa el usuario y la caseta." }, { status: 400 });
    console.error("Station user create failed", error);
    return NextResponse.json(
      { error: "No fue posible crear el usuario." },
      { status: 500 },
    );
  }
}
