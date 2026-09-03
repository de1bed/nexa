import { NextResponse } from "next/server";
import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import { sendInvitationEmail } from "@/lib/server/email";
import { requireApiContext } from "@/lib/server/session";
import { writeAudit, writeNotification } from "@/lib/server/audit";
import { eventSelect, mapEvent, mapVisit, visitSelect } from "@/lib/server/visit-mapper";
import { appUrl } from "@/lib/config";
import { maskEmail, maskPhone } from "@/lib/security";
import { sendInvitationWhatsApp } from "@/lib/server/whatsapp";

export const dynamic = "force-dynamic";

const createSchema = z
  .object({
    visitorName: z.string().trim().max(120).default(""),
    email: z.union([z.literal(""), z.email()]).default(""),
    phone: z.string().trim().max(30).default(""),
    company: z.string().trim().max(120).default(""),
    locationId: z.uuid("Ubicación inválida"),
    hostId: z.uuid().optional(),
    startsAt: z.iso.datetime(),
    endsAt: z.iso.datetime(),
    purpose: z.string().trim().min(2).max(160),
    notes: z.string().trim().max(500).optional(),
    accessRequirements: z.string().trim().max(500).optional(),
    sendEmail: z.boolean().default(false),
    sendWhatsApp: z.boolean().default(false),
  })
  .refine((value) => value.endsAt > value.startsAt, {
    path: ["endsAt"],
    message: "El horario es inválido",
  })
  .refine((value) => !value.sendEmail || Boolean(value.email), {
    path: ["email"],
    message: "El correo es necesario para enviar la invitación",
  })
  .refine((value) => !value.sendWhatsApp || Boolean(value.phone), {
    path: ["phone"],
    message: "El teléfono es necesario para enviar por WhatsApp",
  });

export async function GET() {
  const guard = await requireApiContext();
  if (!guard.ok)
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  const { db, organizationId } = guard.context;

  try {
    const [{ data: visits, error }, { data: events }] = await Promise.all([
      db
        .from("visits")
        .select(visitSelect)
        .eq("organization_id", organizationId)
        .order("starts_at", { ascending: false })
        .limit(500),
      db
        .from("access_events")
        .select(eventSelect)
        .eq("organization_id", organizationId)
        .order("occurred_at", { ascending: false })
        .limit(300),
    ]);
    if (error) throw error;

    return NextResponse.json(
      {
        visits: (visits ?? []).map((row) =>
          mapVisit(row as unknown as Record<string, unknown>),
        ),
        events: (events ?? []).map((row) =>
          mapEvent(row as unknown as Record<string, unknown>),
        ),
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
  const guard = await requireApiContext(["superadmin", "admin", "host"]);
  if (!guard.ok)
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  const { db, organizationId, userId, role, displayName, organizationName } =
    guard.context;

  try {
    const input = createSchema.parse(await request.json());

    // Un anfitrión solo crea visitas a su nombre; administración puede delegar.
    const hostId =
      role === "host" ? userId : (input.hostId ?? userId);
    if (hostId !== userId) {
      const { data: member } = await db
        .from("organization_members")
        .select("profile_id")
        .eq("organization_id", organizationId)
        .eq("profile_id", hostId)
        .eq("active", true)
        .in("role", ["superadmin", "admin", "host"])
        .maybeSingle();
      if (!member)
        return NextResponse.json(
          { error: "El anfitrión no pertenece a la organización" },
          { status: 400 },
        );
    }

    const { data: location } = await db
      .from("locations")
      .select("id,name")
      .eq("id", input.locationId)
      .eq("organization_id", organizationId)
      .eq("active", true)
      .maybeSingle();
    if (!location)
      return NextResponse.json(
        { error: "La ubicación no está disponible" },
        { status: 400 },
      );

    const { data: hostProfile } = await db
      .from("profiles")
      .select("full_name,email")
      .eq("id", hostId)
      .maybeSingle();

    const { data: visit, error: visitError } = await db
      .from("visits")
      .insert({
        organization_id: organizationId,
        location_id: location.id,
        host_id: hostId,
        status: "invited",
        origin: "host_invitation",
        purpose: input.purpose,
        visitor_company: input.company || null,
        starts_at: input.startsAt,
        ends_at: input.endsAt,
        internal_notes: input.notes || null,
        access_requirements: input.accessRequirements || null,
        created_by: userId,
      })
      .select(visitSelect)
      .single();
    if (visitError || !visit) throw visitError ?? new Error("insert failed");

    const visitId = (visit as unknown as { id: string }).id;
    const invitationToken = randomBytes(32).toString("base64url");
    const tokenHash = createHash("sha256").update(invitationToken).digest("hex");

    const { error: invitationError } = await db
      .from("visit_invitations")
      .insert({
        organization_id: organizationId,
        visit_id: visitId,
        token_hash: tokenHash,
        token_hint: `••••${invitationToken.slice(-4)}`,
        expires_at: new Date(
          new Date(input.endsAt).getTime() + 86400000,
        ).toISOString(),
        sent_at:
          input.sendEmail || input.sendWhatsApp ? new Date().toISOString() : null,
        invitee_name: input.visitorName || null,
        invitee_email: input.email || null,
        invitee_phone: input.phone || null,
        invitee_company: input.company || null,
      });
    if (invitationError) throw invitationError;

    await writeAudit({
      organizationId,
      actorId: userId,
      visitId,
      eventType: "invitation_created",
      metadata: {
        sent_email: input.sendEmail,
        sent_whatsapp: input.sendWhatsApp,
        delegated: hostId !== userId,
      },
    });

    const invitationUrl = `${appUrl()}/visit/${invitationToken}`;

    if (input.sendEmail && input.email) {
      const delivery = await sendInvitationEmail({
        to: input.email,
        visitorName: input.visitorName,
        hostName: hostProfile?.full_name ?? displayName,
        organizationName,
        locationName: location.name,
        dateLabel: new Intl.DateTimeFormat("es-MX", {
          dateStyle: "full",
          timeStyle: "short",
        }).format(new Date(input.startsAt)),
        invitationUrl,
      }).catch(() => ({ status: "failed" as const }));

      await writeNotification({
        organizationId,
        visitId,
        recipientMasked: maskEmail(input.email),
        template: "visitor_invitation",
        status: delivery.status,
      });
    }

    const mapped = mapVisit(visit as unknown as Record<string, unknown>);
    if (input.sendWhatsApp && input.phone) {
      const delivery = await sendInvitationWhatsApp({
        to: input.phone,
        visitorName: input.visitorName,
        hostName: hostProfile?.full_name ?? displayName,
        organizationName,
        dateLabel: new Intl.DateTimeFormat("es-MX", {
          dateStyle: "long",
          timeStyle: "short",
        }).format(new Date(input.startsAt)),
        invitationPath: `visit/${invitationToken}`,
      }).catch(() => ({ status: "failed" as const }));

      await writeNotification({
        organizationId,
        visitId,
        recipientMasked: maskPhone(input.phone),
        template: "visitor_invitation",
        status: delivery.status,
        channel: "whatsapp",
      }).catch(() => undefined);
    }

    return NextResponse.json(
      {
        visit: {
          ...mapped,
          visitorName: input.visitorName || mapped.visitorName,
          email: input.email || mapped.email,
          phone: input.phone || mapped.phone,
          company: input.company || mapped.company,
          inviteeName: input.visitorName || undefined,
          inviteeEmail: input.email || undefined,
          inviteePhone: input.phone || undefined,
          inviteeCompany: input.company || undefined,
          invitationToken,
        },
        invitationToken,
        invitationUrl,
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
