import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { isLiveMode } from "@/lib/config";
import { DEMO_COMPANY_CODE, findSeededStation } from "@/lib/demo-stations";
import {
  isStationUsername,
  normalizeCompanyCode,
  normalizeStationUsername,
} from "@/lib/station-access";
import { STATION_BOOTH_COOKIE, STATION_COOKIE } from "@/lib/session-constants";
import { createAdminClient } from "@/lib/server/supabase-admin";

export const dynamic = "force-dynamic";

const schema = z.object({
  companyCode: z.string().trim().min(4).max(40),
  username: z.string().trim().min(3).max(32),
  demoStationId: z.string().trim().min(1).max(80).optional(),
  demoBoothId: z.string().trim().min(1).max(80).optional(),
});

function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  };
}

function clearCookieOptions() {
  return { ...cookieOptions(), maxAge: 0 };
}

async function openStation(stationId: string, boothId: string | null) {
  const jar = await cookies();
  jar.set(STATION_COOKIE, stationId, cookieOptions());
  if (boothId) jar.set(STATION_BOOTH_COOKIE, boothId, cookieOptions());
  else jar.set(STATION_BOOTH_COOKIE, "", clearCookieOptions());
}

export async function POST(request: Request) {
  try {
    const input = schema.parse(await request.json());
    if (!isStationUsername(input.username))
      return NextResponse.json(
        { error: "Esa clave de la tableta o ese usuario no coinciden." },
        { status: 401 },
      );

    if (!isLiveMode()) {
      const seeded = findSeededStation(input.companyCode, input.username);
      if (seeded) {
        await openStation(seeded.id, seeded.boothId);
        return NextResponse.json({ ok: true });
      }
      const companyOk =
        normalizeCompanyCode(input.companyCode) ===
        normalizeCompanyCode(DEMO_COMPANY_CODE);
      if (companyOk && input.demoStationId && input.demoBoothId) {
        await openStation(input.demoStationId, input.demoBoothId);
        return NextResponse.json({ ok: true });
      }
      return NextResponse.json(
        { error: "Esa clave de la tableta o ese usuario no coinciden." },
        { status: 401 },
      );
    }

    const admin = createAdminClient();
    const code = normalizeCompanyCode(input.companyCode);
    const username = normalizeStationUsername(input.username);
    const { data: organizations } = await admin
      .from("organizations")
      .select("id, tablet_company_code")
      .not("tablet_company_code", "is", null);

    const organization = (organizations ?? []).find(
      (item) =>
        normalizeCompanyCode(String(item.tablet_company_code ?? "")) === code,
    );
    if (!organization)
      return NextResponse.json(
        {
          error: "Esa clave de la tableta no es válida.",
          errorType: "invalid_code",
        },
        { status: 401 },
      );

    const { data: station } = await admin
      .from("station_users")
      .select("id, booth_id, active")
      .eq("organization_id", organization.id)
      .eq("username", username)
      .maybeSingle();

    if (!station?.active)
      return NextResponse.json(
        {
          error: "Ese usuario de tableta no existe. Revísalo en Equipo > Casetas.",
          errorType: "user_not_found",
        },
        { status: 401 },
      );

    await openStation(station.id as string, (station.booth_id as string | null) ?? null);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError)
      return NextResponse.json(
        { error: "Revisa la clave de la tableta y el usuario." },
        { status: 400 },
      );
    console.error("Station sign-in failed", error);
    return NextResponse.json(
      { error: "No fue posible abrir la tableta." },
      { status: 500 },
    );
  }
}

export async function GET() {
  const open = Boolean((await cookies()).get(STATION_COOKIE)?.value);
  return NextResponse.json({ open });
}

export async function DELETE() {
  const jar = await cookies();
  jar.set(STATION_COOKIE, "", clearCookieOptions());
  jar.set(STATION_BOOTH_COOKIE, "", clearCookieOptions());
  return NextResponse.json({ ok: true });
}
