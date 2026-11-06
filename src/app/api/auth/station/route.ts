import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { isLiveMode } from "@/lib/config";
import { DEMO_COMPANY_CODE, findSeededStation } from "@/lib/demo-stations";
import {
  formatCompanyCode,
  isStationUsername,
  normalizeCompanyCode,
  normalizeStationUsername,
} from "@/lib/station-access";
import { STATION_BOOTH_COOKIE, STATION_COOKIE } from "@/lib/session-constants";
import { createAdminClient } from "@/lib/server/supabase-admin";
import { rateLimit, requestOrigin } from "@/lib/server/rate-limit";

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
  // Sin límite, la clave y el usuario se podían adivinar a fuerza de intentos.
  const limit = rateLimit(`station:${requestOrigin(request)}`, 20, 5 * 60000);
  if (!limit.allowed)
    return NextResponse.json(
      { error: "Demasiados intentos. Espera unos minutos.", errorType: "generic" },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter) } },
    );
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
    // La clave se guarda con guion (NEXA-XXXXXX); se busca tal cual, sin
    // descargar las claves de todas las empresas.
    const { data: organizations } = await admin
      .from("organizations")
      .select("id, tablet_company_code")
      .in("tablet_company_code", [...new Set([formatCompanyCode(code), code])])
      .limit(2);

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
      .select("id, booth_id, active, booth:booths(active)")
      .eq("organization_id", organization.id)
      .eq("username", username)
      .maybeSingle();

    // Una caseta desactivada en Ubicaciones ya no abre su tableta.
    const booth = station?.booth as unknown as { active?: boolean } | null;
    if (station?.active && station.booth_id && booth?.active === false)
      return NextResponse.json(
        {
          error: "Esa caseta está desactivada. Actívala en Ubicaciones.",
          errorType: "generic",
        },
        { status: 401 },
      );

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
