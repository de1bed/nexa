import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { ORG_COOKIE, SUPPORT_ORG_COOKIE } from "@/lib/session-constants";
import { getSessionContext } from "@/lib/server/session";
import { isPlatformAdmin } from "@/lib/server/platform-admin";
import { createAdminClient } from "@/lib/server/supabase-admin";

export const dynamic = "force-dynamic";

async function guardPlatform() {
  const context = await getSessionContext();
  if (!context.user)
    return { ok: false as const, status: 401, error: "No autenticado" };
  const allowed = await isPlatformAdmin(
    context.user.id,
    context.profile?.email ?? context.user.email ?? "",
  );
  if (!allowed)
    return { ok: false as const, status: 403, error: "Acceso denegado" };
  return { ok: true as const, userId: context.user.id };
}

function cookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  };
}

export async function GET() {
  const guard = await guardPlatform();
  if (!guard.ok)
    return NextResponse.json({ supporting: false });
  const orgId = (await cookies()).get(SUPPORT_ORG_COOKIE)?.value;
  if (!orgId) return NextResponse.json({ supporting: false });
  const admin = createAdminClient();
  const { data } = await admin
    .from("organizations")
    .select("name")
    .eq("id", orgId)
    .maybeSingle();
  return NextResponse.json({
    supporting: true,
    organizationName: (data?.name as string | undefined) ?? "esta empresa",
  });
}

export async function POST(request: Request) {
  const guard = await guardPlatform();
  if (!guard.ok)
    return NextResponse.json({ error: guard.error }, { status: guard.status });

  try {
    const { organizationId } = z
      .object({ organizationId: z.uuid() })
      .parse(await request.json());
    const admin = createAdminClient();
    const { data: organization } = await admin
      .from("organizations")
      .select("id,name")
      .eq("id", organizationId)
      .maybeSingle();
    if (!organization)
      return NextResponse.json({ error: "Esa empresa no está" }, { status: 404 });

    const jar = await cookies();
    const previous = jar.get(SUPPORT_ORG_COOKIE)?.value;
    if (previous && previous !== organizationId) {
      await admin
        .from("organization_members")
        .delete()
        .eq("organization_id", previous)
        .eq("profile_id", guard.userId);
    }

    const { data: existing } = await admin
      .from("organization_members")
      .select("profile_id")
      .eq("organization_id", organizationId)
      .eq("profile_id", guard.userId)
      .maybeSingle();

    if (!existing) {
      const { error } = await admin.from("organization_members").insert({
        organization_id: organizationId,
        profile_id: guard.userId,
        role: "admin",
        status: "active",
        active: true,
      });
      if (error)
        return NextResponse.json(
          { error: "No fue posible abrir esa empresa" },
          { status: 500 },
        );
      jar.set(SUPPORT_ORG_COOKIE, organizationId, cookieOptions(60 * 60 * 12));
    } else {
      jar.delete({ name: SUPPORT_ORG_COOKIE, path: "/" });
    }

    jar.set(ORG_COOKIE, organizationId, cookieOptions(60 * 60 * 24 * 30));
    return NextResponse.json({
      ok: true,
      organizationName: organization.name as string,
    });
  } catch (error) {
    if (error instanceof z.ZodError)
      return NextResponse.json({ error: "Empresa inválida" }, { status: 400 });
    return NextResponse.json(
      { error: "No fue posible abrir esa empresa" },
      { status: 500 },
    );
  }
}

export async function DELETE() {
  const guard = await guardPlatform();
  if (!guard.ok)
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  const jar = await cookies();
  const orgId = jar.get(SUPPORT_ORG_COOKIE)?.value;
  if (orgId) {
    const admin = createAdminClient();
    await admin
      .from("organization_members")
      .delete()
      .eq("organization_id", orgId)
      .eq("profile_id", guard.userId);
  }
  jar.delete({ name: SUPPORT_ORG_COOKIE, path: "/" });
  jar.delete({ name: ORG_COOKIE, path: "/" });
  return NextResponse.json({ ok: true });
}
