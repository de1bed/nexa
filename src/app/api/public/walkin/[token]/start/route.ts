import { NextResponse } from "next/server";
import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import { createAdminClient } from "@/lib/server/supabase-admin";
import { rateLimit, requestOrigin } from "@/lib/server/rate-limit";
import { sendHostWalkinEmail } from "@/lib/server/email";
import { maskEmail } from "@/lib/security";
import { appUrl } from "@/lib/config";
import { passExpiresAt } from "@/lib/pass-window";
import { verifyWalkin } from "@/lib/server/walkin";

export const dynamic = "force-dynamic";

/** Horario que se le asigna a una visita sin cita, a partir de que se registra. */
const WALKIN_HOURS = 4;

const schema = z.object({
  code: z.string().regex(/^\d{4}$/),
  hostId: z.uuid("Elige a quién visitas"),
  visitorName: z.string().trim().min(2, "Escribe tu nombre").max(120),
  company: z.string().trim().max(120).default(""),
  purpose: z.string().trim().min(2, "Escribe el motivo").max(160),
});

/**
 * Crea la visita espontánea y devuelve el enlace de registro normal. Desde ahí
 * el visitante completa exactamente lo que la empresa pide (identificación,
 * vehículo, requisitos, aviso de privacidad) y recibe su QR.
 */
export async function POST(
  request: Request,
  ctx: RouteContext<"/api/public/walkin/[token]/start">,
) {
  const limit = rateLimit(`walkin-start:${requestOrigin(request)}`, 10, 3600000);
  if (!limit.allowed)
    return NextResponse.json(
      { error: "Demasiados registros desde este dispositivo" },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter) } },
    );

  try {
    const { token } = await ctx.params;
    const input = schema.parse(await request.json());

    const access = await verifyWalkin(token, input.code, request);
    if (access.state !== "ok")
      return NextResponse.json(
        {
          error:
            access.state === "locked"
              ? "Demasiados intentos. Espera unos minutos."
              : access.state === "wrong_code"
                ? "El código no es correcto"
                : "Este QR ya no está disponible",
          state: access.state,
        },
        { status: access.state === "locked" ? 429 : 403 },
      );

    const db = createAdminClient();
    const { organizationId, locationId } = access;

    const [{ data: host }, { data: location }, { data: requirements }] =
      await Promise.all([
        db
          .from("organization_members")
          .select(
            "profile_id,profile:profiles!organization_members_profile_id_fkey(full_name,email)",
          )
          .eq("organization_id", organizationId)
          .eq("profile_id", input.hostId)
          .eq("active", true)
          .in("role", ["superadmin", "admin", "host"])
          .maybeSingle(),
        db
          .from("locations")
          .select("name")
          .eq("id", locationId)
          .maybeSingle(),
        db
          .from("organization_requirements")
          .select("id,title,description,ask_photo,ask_text,required")
          .eq("organization_id", organizationId)
          .eq("active", true)
          .eq("apply_by_default", true)
          .order("sort_order"),
      ]);
    if (!host)
      return NextResponse.json(
        { error: "Esa persona no está disponible. Elige otra." },
        { status: 400 },
      );
    const hostProfile = host.profile as unknown as {
      full_name?: string;
      email?: string;
    } | null;

    const startsAt = new Date();
    const endsAt = new Date(startsAt.getTime() + WALKIN_HOURS * 3600000);

    const { data: visit, error: visitError } = await db
      .from("visits")
      .insert({
        organization_id: organizationId,
        location_id: locationId,
        host_id: input.hostId,
        status: "invited",
        origin: "public_link",
        purpose: input.purpose,
        visitor_company: input.company || null,
        starts_at: startsAt.toISOString(),
        ends_at: endsAt.toISOString(),
        pass_valid_days: 1,
        // El pase de una visita sin cita vale solo en la sede donde se registró.
        all_locations: false,
        internal_notes: "Registro en recepción con QR",
        created_by: input.hostId,
      })
      .select("id")
      .single();
    if (visitError || !visit) throw visitError ?? new Error("visit");

    const invitationToken = randomBytes(32).toString("base64url");
    const { error: invitationError } = await db.from("visit_invitations").insert({
      organization_id: organizationId,
      visit_id: visit.id,
      token_hash: createHash("sha256").update(invitationToken).digest("hex"),
      token_hint: `••••${invitationToken.slice(-4)}`,
      expires_at: passExpiresAt(startsAt.toISOString(), 1),
      sent_at: startsAt.toISOString(),
      invitee_name: input.visitorName,
      invitee_company: input.company || null,
    });
    if (invitationError) {
      await db.from("visits").delete().eq("id", visit.id);
      throw invitationError;
    }

    if (requirements?.length) {
      const { error } = await db.from("visit_attachments").insert(
        requirements.map((requirement, index) => ({
          organization_id: organizationId,
          visit_id: visit.id,
          requirement_id: requirement.id,
          source: "requested",
          title: requirement.title,
          description: requirement.description ?? "",
          ask_photo: requirement.ask_photo,
          ask_text: requirement.ask_text,
          required: requirement.required,
          sort_order: index,
        })),
      );
      if (error) {
        await db.from("visits").delete().eq("id", visit.id);
        throw error;
      }
    }

    await db.from("audit_logs").insert({
      organization_id: organizationId,
      visit_id: visit.id,
      event_type: "walkin_registration_started",
      metadata: { point_id: access.pointId, location_id: locationId },
    });

    if (hostProfile?.email) {
      const delivery = await sendHostWalkinEmail({
        to: hostProfile.email,
        hostName: hostProfile.full_name ?? "",
        visitorName: input.visitorName,
        company: input.company || undefined,
        locationName: location?.name ?? "",
        purpose: input.purpose,
        visitUrl: `${appUrl()}/app/visits/${visit.id}`,
      }).catch(() => ({ status: "failed" as const }));
      await db.from("notification_logs").insert({
        organization_id: organizationId,
        visit_id: visit.id,
        channel: "email",
        recipient_masked: maskEmail(hostProfile.email),
        template: "host_walkin",
        status: delivery.status,
      });
    }

    return NextResponse.json(
      { invitationPath: `/visit/${invitationToken}` },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof z.ZodError)
      return NextResponse.json(
        { error: error.issues[0]?.message ?? "Datos inválidos" },
        { status: 400 },
      );
    console.error("Walk-in start failed", error);
    return NextResponse.json(
      { error: "No fue posible iniciar tu registro" },
      { status: 500 },
    );
  }
}
