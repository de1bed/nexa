import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/server/session";
import { isPlatformAdmin } from "@/lib/server/platform-admin";

export const dynamic = "force-dynamic";

export async function GET() {
  const context = await getSessionContext();
  if (!context.user)
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const platformAdmin = await isPlatformAdmin(
    context.user.id,
    context.profile?.email ?? context.user.email ?? "",
  ).catch(() => false);

  if (context.memberships.some((item) => item.serviceStatus === "active")) {
    const active =
      context.memberships.find((item) => item.serviceStatus === "active") ??
      context.memberships[0];
    return NextResponse.json({
      state: "active",
      organizationId: active?.organizationId,
      role: active?.role,
      platformAdmin,
    });
  }

  const { data, error } = await context.db.rpc("my_access_gate");
  if (error)
    return NextResponse.json(
      { error: "No fue posible consultar tu acceso" },
      { status: 500 },
    );

  return NextResponse.json(
    { ...(data as Record<string, unknown>), platformAdmin },
    { headers: { "Cache-Control": "no-store" } },
  );
}
