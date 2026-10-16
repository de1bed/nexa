import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { hashGuardCode, normalizeGuardCode } from "@/lib/guard-code";
import { createAdminClient } from "@/lib/server/supabase-admin";
import { createServerSupabase } from "@/lib/server/supabase";
import { ORG_COOKIE } from "@/lib/server/session";
import { STATION_COOKIE } from "@/lib/session-constants";

export const dynamic = "force-dynamic";

const schema = z.object({
  code: z.string().trim().min(4).max(20),
});

export async function POST(request: Request) {
  try {
    const input = schema.parse(await request.json());
    if (normalizeGuardCode(input.code).length !== 8)
      return NextResponse.json(
        { error: "Ese código no está activo." },
        { status: 401 },
      );

    const admin = createAdminClient();
    const stationId = (await cookies()).get(STATION_COOKIE)?.value;
    if (!stationId)
      return NextResponse.json(
        { error: "Primero abre la tableta con la clave de empresa y el usuario." },
        { status: 401 },
      );

    const { data: station } = await admin
      .from("station_users")
      .select("organization_id, active")
      .eq("id", stationId)
      .maybeSingle();
    if (!station?.active)
      return NextResponse.json(
        { error: "Primero abre la tableta con la clave de empresa y el usuario." },
        { status: 401 },
      );

    const codeHash = await hashGuardCode(input.code);
    const { data: credential } = await admin
      .from("guard_access_codes")
      .select("profile_id, organization_id, active")
      .eq("code_hash", codeHash)
      .eq("active", true)
      .maybeSingle();

    if (!credential || credential.organization_id !== station.organization_id)
      return NextResponse.json(
        { error: "Ese código no está activo." },
        { status: 401 },
      );

    const [{ data: membership }, { data: profile }] = await Promise.all([
      admin
        .from("organization_members")
        .select("role, active, status")
        .eq("organization_id", credential.organization_id)
        .eq("profile_id", credential.profile_id)
        .maybeSingle(),
      admin
        .from("profiles")
        .select("email")
        .eq("id", credential.profile_id)
        .maybeSingle(),
    ]);

    if (
      !profile?.email ||
      membership?.role !== "guard" ||
      membership.active !== true ||
      membership.status === "suspended"
    )
      return NextResponse.json(
        { error: "Ese código no está activo." },
        { status: 401 },
      );

    const link = await admin.auth.admin.generateLink({
      type: "magiclink",
      email: profile.email,
    });
    const tokenHash = link.data.properties?.hashed_token;
    if (link.error || !tokenHash)
      return NextResponse.json(
        { error: "No fue posible abrir la caseta." },
        { status: 500 },
      );

    const db = await createServerSupabase();
    const { error: sessionError } = await db.auth.verifyOtp({
      token_hash: tokenHash,
      type: "magiclink",
    });
    if (sessionError)
      return NextResponse.json(
        { error: "No fue posible abrir la caseta." },
        { status: 500 },
      );

    (await cookies()).set(ORG_COOKIE, credential.organization_id, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });

    return NextResponse.json({ ok: true, redirect: "/guard/scan" });
  } catch (error) {
    if (error instanceof z.ZodError)
      return NextResponse.json({ error: "Revisa el código." }, { status: 400 });
    console.error("Guard code sign-in failed", error);
    return NextResponse.json(
      { error: "No fue posible abrir la caseta." },
      { status: 500 },
    );
  }
}
