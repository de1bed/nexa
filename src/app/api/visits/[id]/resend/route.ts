import { NextResponse } from "next/server";
import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import { requireApiContext } from "@/lib/server/session";
import { sendInvitationEmail, sendPassEmail } from "@/lib/server/email";
import { writeAudit, writeNotification } from "@/lib/server/audit";
import { mapVisit, visitSelect } from "@/lib/server/visit-mapper";
import { getOrIssueStaffPass } from "@/lib/server/pass-issue";
import { createAdminClient } from "@/lib/server/supabase-admin";
import { appUrl } from "@/lib/config";
import { maskEmail } from "@/lib/security";

export const dynamic = "force-dynamic";

const schema = z.object({
  mode: z.enum(["invitation", "pass"]).default("invitation"),
  notify: z.boolean().default(true),
});

const reopenable = ["invited", "pre_registered", "approved"];

export async function POST(
  request: Request,
  ctx: RouteContext<"/api/visits/[id]/resend">,
) {
  const guard = await requireApiContext(["superadmin", "admin", "host"]);
  if (!guard.ok)
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  const { db, organizationId, userId, role, organizationName } = guard.context;

  try {
    const { id } = await ctx.params;
    const body = await request.json().catch(() => ({}));
    const input = schema.parse(body ?? {});

    const { data: row } = await db
      .from("visits")
      .select(visitSelect)
      .eq("id", id)
      .eq("organization_id", organizationId)
      .maybeSingle();
    if (!row)
      return NextResponse.json(
        { error: "Visita no disponible" },
        { status: 404 },
      );

    const visit = mapVisit(row as unknown as Record<string, unknown>);
    if (role === "host" && visit.hostId !== userId)
      return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });
    if (!reopenable.includes(visit.status))
      return NextResponse.json(
        { error: "La visita ya no admite un enlace nuevo" },
        { status: 409 },
      );

    const dateLabel = new Intl.DateTimeFormat("es-MX", {
      dateStyle: "full",
      timeStyle: "short",
    }).format(new Date(visit.startsAt));
    const recipient = visit.email || visit.inviteeEmail || "";

    if (input.mode === "pass") {
      const { passToken, passUrl } = await getOrIssueStaffPass({
        visitId: id,
        organizationId,
        startsAt: visit.startsAt,
        endsAt: visit.endsAt,
        rotate: true,
      });
      if (input.notify && recipient) {
        const delivery = await sendPassEmail({
          to: recipient,
          visitorName: visit.visitorName,
          organizationName,
          dateLabel,
          passUrl,
        }).catch(() => ({ status: "failed" as const }));
        await writeNotification({
          organizationId,
          visitId: id,
          recipientMasked: maskEmail(recipient),
          template: "visitor_pass",
          status: delivery.status,
        }).catch(() => undefined);
      }

      await writeAudit({
        organizationId,
        actorId: userId,
        visitId: id,
        eventType: "pass_reissued",
      });

      return NextResponse.json({ mode: "pass", passToken, passUrl });
    }

    // Enlace de registro: se rota el token y se reabre el formulario para que
    // el visitante pueda completar o corregir sus datos.
    const invitationToken = randomBytes(32).toString("base64url");
    const hash = createHash("sha256").update(invitationToken).digest("hex");
    const admin = createAdminClient();

    const { error } = await admin
      .from("visit_invitations")
      .update({
        token_hash: hash,
        token_hint: `••••${invitationToken.slice(-4)}`,
        expires_at: new Date(
          new Date(visit.endsAt).getTime() + 86400000,
        ).toISOString(),
        revoked_at: null,
        completed_at: null,
        sent_at: input.notify ? new Date().toISOString() : null,
      })
      .eq("visit_id", id)
      .eq("organization_id", organizationId);
    if (error) throw error;

    const invitationUrl = `${appUrl()}/visit/${invitationToken}`;
    if (input.notify && recipient) {
      const delivery = await sendInvitationEmail({
        to: recipient,
        visitorName: visit.visitorName,
        hostName: visit.hostName,
        organizationName,
        locationName: visit.location,
        dateLabel,
        invitationUrl,
      }).catch(() => ({ status: "failed" as const }));
      await writeNotification({
        organizationId,
        visitId: id,
        recipientMasked: maskEmail(recipient),
        template: "visitor_invitation",
        status: delivery.status,
      }).catch(() => undefined);
    }

    await writeAudit({
      organizationId,
      actorId: userId,
      visitId: id,
      eventType: "invitation_resent",
    });

    return NextResponse.json({
      mode: "invitation",
      invitationToken,
      invitationUrl,
    });
  } catch (error) {
    if (error instanceof z.ZodError)
      return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
    console.error("Resend failed", error);
    return NextResponse.json(
      { error: "No fue posible generar el enlace" },
      { status: 500 },
    );
  }
}
