import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiContext } from "@/lib/server/session";
import { writeAudit } from "@/lib/server/audit";
import {
  newWalkinCode,
  newWalkinToken,
  pointColumns,
  toView,
  type PointRow,
} from "@/lib/server/walkin";

export const dynamic = "force-dynamic";

const schema = z.object({
  action: z.enum(["rotate_token", "rotate_code", "activate", "deactivate"]),
});

/**
 * Regenerar el QR deja sin validez la hoja impresa. Regenerar el código
 * conserva el QR, pero el código impreso deja de servir. En ambos casos hay
 * que volver a imprimir. Pausar detiene los registros sin cambiar nada.
 */
export async function PATCH(
  request: Request,
  ctx: RouteContext<"/api/walkin/[id]">,
) {
  const guard = await requireApiContext(["superadmin", "admin"]);
  if (!guard.ok)
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  const { db, organizationId, userId } = guard.context;

  try {
    const { id } = await ctx.params;
    const { action } = schema.parse(await request.json());

    const { data: current } = await db
      .from("walkin_points")
      .select("access_code")
      .eq("id", id)
      .eq("organization_id", organizationId)
      .maybeSingle();
    if (!current)
      return NextResponse.json(
        { error: "QR de recepción no disponible" },
        { status: 404 },
      );

    const now = new Date().toISOString();
    // Cambiar token o código limpia el bloqueo por intentos: es una hoja nueva.
    const unlock = {
      failures_in_window: 0,
      failures_window_started_at: null,
      locked_until: null,
    };
    const patch =
      action === "rotate_token"
        ? { public_token: newWalkinToken(), token_rotated_at: now, ...unlock }
        : action === "rotate_code"
          ? {
              access_code: newWalkinCode(current.access_code as string),
              code_rotated_at: now,
              ...unlock,
            }
          : { active: action === "activate" };

    const { data, error } = await db
      .from("walkin_points")
      .update(patch)
      .eq("id", id)
      .eq("organization_id", organizationId)
      .select(pointColumns)
      .single();
    if (error || !data) throw error ?? new Error("update failed");

    await writeAudit({
      organizationId,
      actorId: userId,
      eventType: `walkin_${action}`,
      metadata: { point_id: id },
    });

    return NextResponse.json({ point: toView(data as PointRow) });
  } catch (error) {
    if (error instanceof z.ZodError)
      return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
    console.error("Walk-in PATCH failed", error);
    return NextResponse.json(
      { error: "No fue posible actualizar el QR de recepción" },
      { status: 500 },
    );
  }
}
