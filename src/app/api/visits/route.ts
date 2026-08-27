import { NextResponse } from "next/server";
import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import { sendInvitationEmail } from "@/lib/server/email";
import { getSessionContext } from "@/lib/server/session";
import { writeAudit } from "@/lib/server/audit";

const createSchema = z
  .object({
    visitorName: z.string().min(2).max(120),
    email: z.email(),
    phone: z.string().max(30).optional(),
    company: z.string().min(2).max(120),
    location: z.string().min(1).max(160),
    startsAt: z.iso.datetime(),
    endsAt: z.iso.datetime(),
    purpose: z.string().min(2).max(160),
    notes: z.string().max(500).optional(),
    accessRequirements: z.string().max(500).optional(),
    sendEmail: z.boolean(),
  })
  .refine((value) => value.endsAt > value.startsAt, {
    path: ["endsAt"],
    message: "Horario inválido",
  });

function mapVisit(row: Record<string, unknown>) {
  const visitor = row.visitor as null | {
    full_name?: string;
    email?: string;
    phone?: string;
    company?: string;
  };
  const host = row.host as null | { full_name?: string };
  const location = row.location as null | { name?: string };
  return {
    id: row.id,
    visitorName: visitor?.full_name ?? "Visitante",
    email: visitor?.email ?? "",
    phone: visitor?.phone,
    company: String(row.visitor_company ?? visitor?.company ?? ""),
    hostName: host?.full_name ?? "Anfitrión",
    hostId: row.host_id,
    location: location?.name ?? "Ubicación",
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    checkedInAt: row.checked_in_at ?? undefined,
    checkedOutAt: row.checked_out_at ?? undefined,
    purpose: row.purpose,
    status: row.status,
    origin: row.origin,
    notes: row.internal_notes ?? undefined,
    vehiclePlate: row.vehicle_plate ?? undefined,
    documentCaptured: Array.isArray(row.documents) && row.documents.length > 0,
    consentedAt: row.consented_at ?? undefined,
    denialReason: row.denial_reason ?? undefined,
  };
}

export async function GET() {
  try {
    const context = await getSessionContext();
    const { db, user, selected } = context;
    if (!user)
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    if (!selected)
      return NextResponse.json(
        { error: "Selecciona una organización" },
        { status: 409 },
      );
    const { data, error } = await db
      .from("visits")
      .select(
        "*,visitor:visitors(full_name,email,phone,company),host:profiles!visits_host_id_fkey(full_name),location:locations(name),documents:visitor_documents(id)",
      )
      .eq("organization_id", selected.organizationId)
      .order("starts_at", { ascending: false })
      .limit(500);
    if (error) throw error;
    const { data: events } = await db
      .from("access_events")
      .select(
        "id,visit_id,event_type,occurred_at,reason,actor:profiles!access_events_actor_id_fkey(full_name)",
      )
      .eq("organization_id", selected.organizationId)
      .order("occurred_at", { ascending: false })
      .limit(200);
    return NextResponse.json(
      {
        visits: (data ?? []).map((row) =>
          mapVisit(row as unknown as Record<string, unknown>),
        ),
        events: (events ?? []).map((event) => ({
          id: event.id,
          visitId: event.visit_id,
          type: event.event_type,
          at: event.occurred_at,
          actor:
            (event.actor as unknown as { full_name?: string } | null)
              ?.full_name ?? "Sistema",
          detail: event.reason ?? undefined,
        })),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("Visits GET failed", error);
    return NextResponse.json(
      { error: "No fue posible cargar las visitas" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const input = createSchema.parse(await request.json());
    const context = await getSessionContext();
    const { db, user, selected } = context;
    if (!user)
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    if (!selected)
      return NextResponse.json(
        { error: "Selecciona una organización" },
        { status: 409 },
      );
    if (!["admin", "host", "superadmin"].includes(selected.role))
      return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });
    const { data: location } = await db
      .from("locations")
      .select("id,name")
      .eq("organization_id", selected.organizationId)
      .eq("name", input.location)
      .eq("active", true)
      .single();
    if (!location)
      return NextResponse.json(
        { error: "Ubicación no disponible" },
        { status: 400 },
      );
    const { data: profile } = await db
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .single();
    const { data: visitor, error: visitorError } = await db
      .from("visitors")
      .insert({
        organization_id: selected.organizationId,
        full_name: input.visitorName,
        email: input.email,
        phone: input.phone || null,
        company: input.company,
      })
      .select("id")
      .single();
    if (visitorError || !visitor) throw visitorError;
    const { data: visit, error: visitError } = await db
      .from("visits")
      .insert({
        organization_id: selected.organizationId,
        location_id: location.id,
        visitor_id: visitor.id,
        host_id: user.id,
        status: "invited",
        origin: "host_invitation",
        purpose: input.purpose,
        visitor_company: input.company,
        starts_at: input.startsAt,
        ends_at: input.endsAt,
        internal_notes: input.notes || null,
        access_requirements: input.accessRequirements || null,
        created_by: user.id,
      })
      .select("id")
      .single();
    if (visitError || !visit) throw visitError;
    const invitationToken = randomBytes(32).toString("base64url");
    const tokenHash = createHash("sha256")
      .update(invitationToken)
      .digest("hex");
    await db.from("visit_invitations").insert({
      organization_id: selected.organizationId,
      visit_id: visit.id,
      token_hash: tokenHash,
      token_hint: `••••${invitationToken.slice(-4)}`,
      expires_at: new Date(
        new Date(input.endsAt).getTime() + 86400000,
      ).toISOString(),
      sent_at: input.sendEmail ? new Date().toISOString() : null,
    });
    await writeAudit({
      organizationId: selected.organizationId,
      actorId: user.id,
      visitId: visit.id,
      eventType: "invitation_created",
      metadata: { sent: input.sendEmail },
    });
    if (input.sendEmail)
      await sendInvitationEmail({
        to: input.email,
        visitorName: input.visitorName,
        hostName: profile?.full_name ?? "tu anfitrión",
        dateLabel: new Intl.DateTimeFormat("es-MX", {
          dateStyle: "full",
          timeStyle: "short",
        }).format(new Date(input.startsAt)),
        invitationUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/visit/${invitationToken}`,
      });
    return NextResponse.json(
      {
        visit: mapVisit({
          id: visit.id,
          visitor: {
            full_name: input.visitorName,
            email: input.email,
            phone: input.phone,
            company: input.company,
          },
          host: { full_name: profile?.full_name },
          host_id: user.id,
          location: { name: location.name },
          visitor_company: input.company,
          starts_at: input.startsAt,
          ends_at: input.endsAt,
          purpose: input.purpose,
          status: "invited",
          origin: "host_invitation",
          internal_notes: input.notes,
          documents: [],
        }),
        invitationToken,
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof z.ZodError)
      return NextResponse.json(
        { error: "Datos inválidos", issues: error.issues },
        { status: 400 },
      );
    console.error("Visits POST failed", error);
    return NextResponse.json(
      { error: "No fue posible crear la invitación" },
      { status: 500 },
    );
  }
}
