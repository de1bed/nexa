import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiContext } from "@/lib/server/session";
import { writeAudit } from "@/lib/server/audit";
import { requirementSchema } from "@/lib/schemas";
import { mapRequirement, requirementColumns } from "@/lib/server/requirements";

export const dynamic = "force-dynamic";

/**
 * Editar un requisito no cambia las invitaciones ya creadas: cada visita
 * guardó su propia copia al crearse.
 */
export async function PATCH(
  request: Request,
  ctx: RouteContext<"/api/requirements/[id]">,
) {
  const guard = await requireApiContext(["superadmin", "admin"]);
  if (!guard.ok)
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  const { db, organizationId, userId } = guard.context;

  try {
    const { id } = await ctx.params;
    const input = requirementSchema.parse(await request.json());

    const { data, error } = await db
      .from("organization_requirements")
      .update({
        title: input.title,
        description: input.description,
        ask_photo: input.askPhoto,
        ask_text: input.askText,
        required: input.required,
        apply_by_default: input.applyByDefault,
      })
      .eq("id", id)
      .eq("organization_id", organizationId)
      .eq("active", true)
      .select(requirementColumns)
      .maybeSingle();
    if (error) throw error;
    if (!data)
      return NextResponse.json(
        { error: "Requisito no disponible" },
        { status: 404 },
      );

    await writeAudit({
      organizationId,
      actorId: userId,
      eventType: "requirement_updated",
      metadata: { requirement_id: id },
    });

    return NextResponse.json({
      requirement: mapRequirement(data as unknown as Record<string, unknown>),
    });
  } catch (error) {
    if (error instanceof z.ZodError)
      return NextResponse.json(
        { error: error.issues[0]?.message ?? "Datos inválidos" },
        { status: 400 },
      );
    console.error("Requirement PATCH failed", error);
    return NextResponse.json(
      { error: "No fue posible guardar el requisito" },
      { status: 500 },
    );
  }
}

/** Se archiva en lugar de borrarse: las visitas que lo usaron conservan su copia. */
export async function DELETE(
  _request: Request,
  ctx: RouteContext<"/api/requirements/[id]">,
) {
  const guard = await requireApiContext(["superadmin", "admin"]);
  if (!guard.ok)
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  const { db, organizationId, userId } = guard.context;

  const { id } = await ctx.params;
  const { data, error } = await db
    .from("organization_requirements")
    .update({ active: false })
    .eq("id", id)
    .eq("organization_id", organizationId)
    .select("id")
    .maybeSingle();

  if (error || !data)
    return NextResponse.json(
      { error: "Requisito no disponible" },
      { status: 404 },
    );

  await writeAudit({
    organizationId,
    actorId: userId,
    eventType: "requirement_archived",
    metadata: { requirement_id: id },
  });

  return NextResponse.json({ ok: true });
}
