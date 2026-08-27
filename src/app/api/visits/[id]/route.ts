import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionContext } from "@/lib/server/session";
import { sendHostArrivalEmail } from "@/lib/server/email";
import { writeAudit, writeNotification } from "@/lib/server/audit";

const schema = z.object({
  status: z
    .enum(["cancelled", "checked_in", "checked_out", "denied"])
    .optional(),
  denialReason: z.string().min(2).max(300).optional(),
  allowOutsideWindow: z.boolean().optional(),
});

export async function PATCH(
  request: Request,
  ctx: RouteContext<"/api/visits/[id]">,
) {
  try {
    const input = schema.parse(await request.json());
    const { id } = await ctx.params;
    const context = await getSessionContext();
    const { db, user, selected } = context;
    if (!user)
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    if (!selected)
      return NextResponse.json(
        { error: "Selecciona una organización" },
        { status: 409 },
      );
    const { data: scopedVisit } = await db
      .from("visits")
      .select("id")
      .eq("id", id)
      .eq("organization_id", selected.organizationId)
      .single();
    if (!scopedVisit)
      return NextResponse.json(
        { error: "Visita no disponible" },
        { status: 404 },
      );
    if (
      input.status === "checked_in" ||
      input.status === "checked_out" ||
      input.status === "denied"
    ) {
      const decision =
        input.status === "checked_in"
          ? "check_in"
          : input.status === "checked_out"
            ? "check_out"
            : "deny";
      const { data, error } = await db.rpc("record_access_decision", {
        p_visit_id: id,
        p_decision: decision,
        p_reason: input.denialReason ?? null,
        p_allow_outside_window: input.allowOutsideWindow ?? false,
      });
      if (error)
        return NextResponse.json({ error: error.message }, { status: 409 });
      if (input.status === "checked_in") {
        const { data: detail } = await db
          .from("visits")
          .select(
            "organization_id,visitor:visitors(full_name),host:profiles!visits_host_id_fkey(full_name,email)",
          )
          .eq("id", id)
          .single();
        const host = detail?.host as unknown as {
          full_name?: string;
          email?: string;
        } | null;
        const visitor = detail?.visitor as unknown as {
          full_name?: string;
        } | null;
        if (host?.email) {
          const delivery = await sendHostArrivalEmail({
            to: host.email,
            hostName: host.full_name ?? "Anfitrión",
            visitorName: visitor?.full_name ?? "Tu visitante",
          }).catch(() => ({ status: "failed" as const }));
          await writeNotification({
            organizationId: detail!.organization_id,
            visitId: id,
            recipientMasked: host.email.replace(/(^.).*(@.*$)/, "$1•••$2"),
            template: "host_arrival",
            status: delivery.status,
          });
        }
      }
      return NextResponse.json({ visit: data });
    }
    if (input.status === "cancelled") {
      const { data: visit, error } = await db
        .from("visits")
        .update({
          status: "cancelled",
          cancelled_at: new Date().toISOString(),
          cancelled_by: user.id,
        })
        .eq("id", id)
        .eq("organization_id", selected.organizationId)
        .select("organization_id")
        .single();
      if (error || !visit)
        return NextResponse.json(
          { error: "No fue posible cancelar" },
          { status: 403 },
        );
      await db
        .from("visit_invitations")
        .update({ revoked_at: new Date().toISOString() })
        .eq("visit_id", id);
      await db
        .from("qr_tokens")
        .update({ revoked_at: new Date().toISOString() })
        .eq("visit_id", id);
      await writeAudit({
        organizationId: visit.organization_id,
        actorId: user.id,
        visitId: id,
        eventType: "invitation_cancelled",
      });
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: "Sin cambios" }, { status: 400 });
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
