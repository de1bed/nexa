import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiContext } from "@/lib/server/session";
import { writeAudit } from "@/lib/server/audit";
import { teamUpdateSchema } from "@/lib/schemas";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  ctx: RouteContext<"/api/team/[id]">,
) {
  const guard = await requireApiContext(["superadmin", "admin"]);
  if (!guard.ok)
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  const { db, organizationId, userId } = guard.context;

  try {
    const { id } = await ctx.params;
    const input = teamUpdateSchema.parse(await request.json());
    if (input.role === undefined && input.active === undefined)
      return NextResponse.json({ error: "Sin cambios" }, { status: 400 });

    // Nadie puede quitarse a sí mismo la administración y dejar la empresa huérfana.
    if (id === userId)
      return NextResponse.json(
        { error: "No puedes modificar tu propio acceso" },
        { status: 400 },
      );

    if (input.role !== undefined || input.active === false) {
      const { count } = await db
        .from("organization_members")
        .select("profile_id", { count: "exact", head: true })
        .eq("organization_id", organizationId)
        .eq("active", true)
        .in("role", ["superadmin", "admin"]);
      const { data: target } = await db
        .from("organization_members")
        .select("role")
        .eq("organization_id", organizationId)
        .eq("profile_id", id)
        .maybeSingle();
      const demoting =
        target &&
        ["superadmin", "admin"].includes(target.role as string) &&
        (input.active === false ||
          (input.role !== undefined && !["admin"].includes(input.role)));
      if (demoting && (count ?? 0) <= 1)
        return NextResponse.json(
          { error: "La organización debe conservar al menos una administración" },
          { status: 409 },
        );
    }

    const payload: Record<string, unknown> = {};
    if (input.role !== undefined) payload.role = input.role;
    if (input.active !== undefined) payload.active = input.active;

    const { data, error } = await db
      .from("organization_members")
      .update(payload)
      .eq("organization_id", organizationId)
      .eq("profile_id", id)
      .select("profile_id,role,active")
      .maybeSingle();

    if (error || !data)
      return NextResponse.json(
        { error: "Integrante no disponible" },
        { status: 404 },
      );

    await writeAudit({
      organizationId,
      actorId: userId,
      eventType: "member_updated",
      metadata: { profile_id: id, ...payload },
    });

    return NextResponse.json({
      member: { id: data.profile_id, role: data.role, active: data.active },
    });
  } catch (error) {
    if (error instanceof z.ZodError)
      return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
    console.error("Team PATCH failed", error);
    return NextResponse.json(
      { error: "No fue posible actualizar al integrante" },
      { status: 500 },
    );
  }
}
