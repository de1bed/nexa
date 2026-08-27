import { NextResponse } from "next/server";
import { createHash, randomBytes } from "node:crypto";
import { getSessionContext } from "@/lib/server/session";
import { sendInvitationEmail } from "@/lib/server/email";
import { writeAudit } from "@/lib/server/audit";
export async function POST(
  _request: Request,
  ctx: RouteContext<"/api/visits/[id]/resend">,
) {
  try {
    const { id } = await ctx.params;
    const context = await getSessionContext();
    if (!context.user)
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    if (
      !context.selected ||
      !["admin", "superadmin", "host"].includes(context.selected.role)
    )
      return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });
    const { data: visit } = await context.db
      .from("visits")
      .select(
        "id,organization_id,host_id,starts_at,ends_at,status,visitor:visitors(full_name,email),host:profiles!visits_host_id_fkey(full_name)",
      )
      .eq("id", id)
      .eq("organization_id", context.selected.organizationId)
      .single();
    if (
      !visit ||
      (context.selected.role === "host" && visit.host_id !== context.user.id) ||
      !["invited", "pre_registered", "approved"].includes(visit.status)
    )
      return NextResponse.json(
        { error: "Visita no disponible" },
        { status: 404 },
      );
    const token = randomBytes(32).toString("base64url");
    const hash = createHash("sha256").update(token).digest("hex");
    const expiresAt = new Date(
      new Date(visit.ends_at).getTime() + 86400000,
    ).toISOString();
    await context.db
      .from("visit_invitations")
      .update({
        token_hash: hash,
        token_hint: `••••${token.slice(-4)}`,
        expires_at: expiresAt,
        revoked_at: null,
        sent_at: new Date().toISOString(),
      })
      .eq("visit_id", id);
    const visitor = visit.visitor as unknown as {
      full_name?: string;
      email?: string;
    } | null;
    const host = visit.host as unknown as { full_name?: string } | null;
    if (visitor?.email)
      await sendInvitationEmail({
        to: visitor.email,
        visitorName: visitor.full_name ?? "Visitante",
        hostName: host?.full_name ?? "tu anfitrión",
        dateLabel: new Intl.DateTimeFormat("es-MX", {
          dateStyle: "full",
          timeStyle: "short",
        }).format(new Date(visit.starts_at)),
        invitationUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/visit/${token}`,
      });
    await writeAudit({
      organizationId: context.selected.organizationId,
      actorId: context.user.id,
      visitId: id,
      eventType: "invitation_resent",
    });
    return NextResponse.json({ invitationToken: token });
  } catch {
    return NextResponse.json(
      { error: "No fue posible reenviar" },
      { status: 500 },
    );
  }
}
