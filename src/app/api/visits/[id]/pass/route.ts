import { NextResponse } from "next/server";
import { requireApiContext } from "@/lib/server/session";
import { createAdminClient } from "@/lib/server/supabase-admin";
import { getOrIssueStaffPass } from "@/lib/server/pass-issue";

export const dynamic = "force-dynamic";

const withPass = [
  "pre_registered",
  "approved",
  "checked_in",
  "checked_out",
];

/**
 * Pase vigente para descargar o compartir desde el panel.
 * No manda correo y no rota el QR si ya existe uno recuperable.
 */
export async function GET(
  _request: Request,
  ctx: RouteContext<"/api/visits/[id]/pass">,
) {
  const guard = await requireApiContext(["superadmin", "admin", "host"]);
  if (!guard.ok)
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  const { organizationId, userId, role } = guard.context;
  const { id } = await ctx.params;

  try {
    const admin = createAdminClient();
    const { data: visit } = await admin
      .from("visits")
      .select("id,host_id,status,starts_at,ends_at")
      .eq("id", id)
      .eq("organization_id", organizationId)
      .maybeSingle();
    if (!visit)
      return NextResponse.json(
        { error: "Visita no disponible" },
        { status: 404 },
      );
    if (role === "host" && visit.host_id !== userId)
      return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });
    if (!withPass.includes(visit.status as string))
      return NextResponse.json(
        { error: "Esta visita todavía no tiene pase QR" },
        { status: 409 },
      );

    const pass = await getOrIssueStaffPass({
      visitId: visit.id as string,
      organizationId,
      startsAt: visit.starts_at as string,
      endsAt: visit.ends_at as string,
    });

    return NextResponse.json(pass, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("Staff pass GET failed", error);
    return NextResponse.json(
      { error: "No fue posible abrir el pase" },
      { status: 500 },
    );
  }
}
