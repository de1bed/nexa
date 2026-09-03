import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiContext } from "@/lib/server/session";
import { sendHostArrivalEmail } from "@/lib/server/email";
import { writeAudit, writeNotification } from "@/lib/server/audit";
import { mapVisit, visitSelect } from "@/lib/server/visit-mapper";
import { maskEmail } from "@/lib/security";

export const dynamic = "force-dynamic";

const schema = z.object({
  status: z.enum(["cancelled", "checked_in", "checked_out", "denied"]),
  denialReason: z.string().trim().min(2).max(300).optional(),
  allowOutsideWindow: z.boolean().optional(),
});

const decisionByStatus = {
  checked_in: "check_in",
  checked_out: "check_out",
  denied: "deny",
} as const;

export async function GET(
  _request: Request,
  ctx: RouteContext<"/api/visits/[id]">,
) {
  const guard = await requireApiContext();
  if (!guard.ok)
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  const { db, organizationId } = guard.context;
  const { id } = await ctx.params;

  const { data, error } = await db
    .from("visits")
    .select(visitSelect)
    .eq("id", id)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (error || !data)
    return NextResponse.json({ error: "Visita no disponible" }, { status: 404 });

  return NextResponse.json(
    { visit: mapVisit(data as unknown as Record<string, unknown>) },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function PATCH(
  request: Request,
  ctx: RouteContext<"/api/visits/[id]">,
) {
  const guard = await requireApiContext();
  if (!guard.ok)
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  const { db, organizationId, userId, role } = guard.context;

  try {
    const input = schema.parse(await request.json());
    const { id } = await ctx.params;

    const { data: scoped } = await db
      .from("visits")
      .select("id,host_id,status")
      .eq("id", id)
      .eq("organization_id", organizationId)
      .maybeSingle();
    if (!scoped)
      return NextResponse.json(
        { error: "Visita no disponible" },
        { status: 404 },
      );

    if (input.status === "cancelled") {
      if (!["superadmin", "admin", "host"].includes(role))
        return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });
      if (role === "host" && scoped.host_id !== userId)
        return NextResponse.json(
          { error: "Solo puedes cancelar tus propias visitas" },
          { status: 403 },
        );

      const now = new Date().toISOString();
      const { error } = await db
        .from("visits")
        .update({ status: "cancelled", cancelled_at: now, cancelled_by: userId })
        .eq("id", id)
        .eq("organization_id", organizationId);
      if (error)
        return NextResponse.json(
          { error: "No fue posible cancelar la visita" },
          { status: 409 },
        );

      await Promise.all([
        db
          .from("visit_invitations")
          .update({ revoked_at: now })
          .eq("visit_id", id)
          .is("revoked_at", null),
        db
          .from("qr_tokens")
          .update({ revoked_at: now })
          .eq("visit_id", id)
          .is("revoked_at", null),
      ]);

      await writeAudit({
        organizationId,
        actorId: userId,
        visitId: id,
        eventType: "invitation_cancelled",
      });
    } else {
      if (!["superadmin", "admin", "guard"].includes(role))
        return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });
      if (input.status === "denied" && !input.denialReason)
        return NextResponse.json(
          { error: "El motivo del rechazo es obligatorio" },
          { status: 400 },
        );

      const { error } = await db.rpc("record_access_decision", {
        p_visit_id: id,
        p_decision: decisionByStatus[input.status],
        p_reason: input.denialReason ?? null,
        p_allow_outside_window: input.allowOutsideWindow ?? false,
      });
      if (error)
        return NextResponse.json(
          { error: error.message || "No fue posible registrar la decisión" },
          { status: 409 },
        );
    }

    const { data: updated } = await db
      .from("visits")
      .select(visitSelect)
      .eq("id", id)
      .eq("organization_id", organizationId)
      .maybeSingle();
    const visit = updated
      ? mapVisit(updated as unknown as Record<string, unknown>)
      : null;

    // Aviso al anfitrión: nunca bloquea ni revierte el registro de entrada.
    if (input.status === "checked_in" && visit?.hostEmail) {
      const delivery = await sendHostArrivalEmail({
        to: visit.hostEmail,
        hostName: visit.hostName,
        visitorName: visit.visitorName,
        locationName: visit.location,
        timeLabel: new Intl.DateTimeFormat("es-MX", {
          timeStyle: "short",
        }).format(new Date()),
      }).catch(() => ({ status: "failed" as const }));

      await writeNotification({
        organizationId,
        visitId: id,
        recipientMasked: maskEmail(visit.hostEmail),
        template: "host_arrival",
        status: delivery.status,
      }).catch(() => undefined);
    }

    return NextResponse.json({ visit });
  } catch (error) {
    if (error instanceof z.ZodError)
      return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
    console.error("Visit PATCH failed", error);
    return NextResponse.json(
      { error: "No fue posible actualizar la visita" },
      { status: 500 },
    );
  }
}
