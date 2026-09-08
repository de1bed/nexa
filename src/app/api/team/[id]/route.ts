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
    if (
      input.role === undefined &&
      input.active === undefined &&
      input.status === undefined
    )
      return NextResponse.json({ error: "Sin cambios" }, { status: 400 });

    // Nadie puede quitarse a sí mismo la administración y dejar la empresa huérfana.
    if (id === userId)
      return NextResponse.json(
        { error: "No puedes modificar tu propio acceso" },
        { status: 400 },
      );

    if (input.role !== undefined || input.active === false || input.status === "suspended") {
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
          input.status === "suspended" ||
          (input.role !== undefined && !["admin"].includes(input.role)));
      if (demoting && (count ?? 0) <= 1)
        return NextResponse.json(
          { error: "La organización debe conservar al menos una administración" },
          { status: 409 },
        );
    }

    const payload: Record<string, unknown> = {};
    if (input.role !== undefined) payload.role = input.role;
    if (input.status !== undefined) payload.status = input.status;
    else if (input.active !== undefined) payload.active = input.active;

    const { data, error } = await db
      .from("organization_members")
      .update(payload)
      .eq("organization_id", organizationId)
      .eq("profile_id", id)
      .select("profile_id,role,active,status")
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
      member: {
        id: data.profile_id,
        role: data.role,
        active: data.active,
        status: data.status,
      },
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

export async function DELETE(
  _request: Request,
  ctx: RouteContext<"/api/team/[id]">,
) {
  const guard = await requireApiContext(["superadmin", "admin"]);
  if (!guard.ok)
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  const { db, organizationId, userId } = guard.context;

  try {
    const { id } = await ctx.params;
    if (id === userId)
      return NextResponse.json(
        { error: "No puedes eliminarte a ti mismo" },
        { status: 400 },
      );

    const { data: target } = await db
      .from("organization_members")
      .select("role,status")
      .eq("organization_id", organizationId)
      .eq("profile_id", id)
      .maybeSingle();
    if (!target)
      return NextResponse.json(
        { error: "Integrante no disponible" },
        { status: 404 },
      );

    if (["superadmin", "admin"].includes(target.role as string)) {
      const { count } = await db
        .from("organization_members")
        .select("profile_id", { count: "exact", head: true })
        .eq("organization_id", organizationId)
        .eq("status", "active")
        .in("role", ["superadmin", "admin"]);
      if ((count ?? 0) <= 1)
        return NextResponse.json(
          { error: "La organización debe conservar al menos una administración" },
          { status: 409 },
        );
    }

    await db
      .from("team_invitations")
      .update({ revoked_at: new Date().toISOString() })
      .eq("organization_id", organizationId)
      .eq("profile_id", id)
      .is("accepted_at", null)
      .is("revoked_at", null);

    const { error } = await db
      .from("organization_members")
      .delete()
      .eq("organization_id", organizationId)
      .eq("profile_id", id);
    if (error) throw error;

    await writeAudit({
      organizationId,
      actorId: userId,
      eventType: "member_removed",
      metadata: { profile_id: id, role: target.role },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Team DELETE failed", error);
    return NextResponse.json(
      { error: "No fue posible eliminar al integrante" },
      { status: 500 },
    );
  }
}
