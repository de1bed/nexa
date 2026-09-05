import { NextResponse } from "next/server";
import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import { createAdminClient } from "@/lib/server/supabase-admin";
import { rateLimit, requestOrigin } from "@/lib/server/rate-limit";
import { sendPassEmail } from "@/lib/server/email";
import { appUrl } from "@/lib/config";
import { maskDocument, maskEmail } from "@/lib/security";
import { walletAvailability } from "@/lib/server/wallet/config";

export const dynamic = "force-dynamic";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 8 * 1024 * 1024;

const schema = z.object({
  fullName: z.string().trim().min(2).max(120),
  email: z.email(),
  phone: z.string().trim().min(7).max(30),
  company: z.string().trim().min(2).max(120),
  documentType: z.string().trim().max(40).optional(),
  documentNumber: z.string().trim().max(80).optional(),
  vehiclePlate: z.string().trim().max(20).optional(),
  visitorNotes: z.string().trim().max(500).optional(),
  ocrConfidence: z.coerce.number().min(0).max(100).optional(),
  ocrVerified: z.enum(["true", "false"]).optional(),
  documentExpiresAt: z.string().max(20).optional(),
  consent: z.literal("true"),
});

const SIDES = [
  { field: "documentFront", type: "identity_front" },
  { field: "documentBack", type: "identity_back" },
] as const;

export async function POST(
  request: Request,
  ctx: RouteContext<"/api/public/invitations/[token]/register">,
) {
  const limit = rateLimit(`register:${requestOrigin(request)}`, 8, 300000);
  if (!limit.allowed)
    return NextResponse.json(
      { error: "Demasiados intentos. Espera unos minutos." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter) } },
    );

  try {
    const { token } = await ctx.params;
    const form = await request.formData();
    const values = schema.parse(
      Object.fromEntries(
        [...form.entries()].filter(([, value]) => typeof value === "string"),
      ),
    );

    const images: Array<{ file: File; type: string }> = [];
    for (const side of SIDES) {
      const image = form.get(side.field);
      if (!(image instanceof File) || image.size === 0) continue;
      if (!ALLOWED_TYPES.includes(image.type))
        return NextResponse.json(
          { error: "Las imágenes deben ser JPG, PNG o WebP" },
          { status: 400 },
        );
      if (image.size > MAX_BYTES)
        return NextResponse.json(
          { error: "Alguna imagen supera 8 MB" },
          { status: 400 },
        );
      images.push({ file: image, type: side.type });
    }

    const db = createAdminClient();
    const { data: resolvedRow } = await db
      .rpc("resolve_invitation", { p_token: token })
      .maybeSingle();
    const resolved = resolvedRow as null | {
      state: string;
      visit_id: string;
      organization_name: string;
      retention_days: number;
    };
    if (!resolved || resolved.state !== "active")
      return NextResponse.json(
        { error: "Este enlace ya no está disponible" },
        { status: 404 },
      );

    const { data: visit } = await db
      .from("visits")
      .select("id,organization_id,visitor_id,starts_at,ends_at")
      .eq("id", resolved.visit_id)
      .maybeSingle();
    if (!visit)
      return NextResponse.json(
        { error: "Este enlace ya no está disponible" },
        { status: 404 },
      );

    const masked = values.documentNumber
      ? maskDocument(values.documentNumber)
      : null;

    const visitorPayload = {
      organization_id: visit.organization_id,
      full_name: values.fullName,
      email: values.email,
      phone: values.phone,
      company: values.company,
      document_type: values.documentType || (images.length ? "INE" : "No presentada"),
      document_number_masked: masked,
    };

    let visitorId = visit.visitor_id as string | null;
    if (visitorId) {
      const { error } = await db
        .from("visitors")
        .update(visitorPayload)
        .eq("id", visitorId)
        .eq("organization_id", visit.organization_id);
      if (error) throw error;
    } else {
      const { data: created, error } = await db
        .from("visitors")
        .insert(visitorPayload)
        .select("id")
        .single();
      if (error || !created) throw error ?? new Error("visitor");
      visitorId = created.id;
    }

    const { data: settings } = await db
      .from("organization_settings")
      .select("document_retention_days,privacy_notice_version,require_identification")
      .eq("organization_id", visit.organization_id)
      .maybeSingle();
    if (settings?.require_identification !== false && images.length < 2)
      return NextResponse.json(
        { error: "Faltan las fotos de tu identificación" },
        { status: 400 },
      );
    const retentionDays = settings?.document_retention_days ?? 30;
    const retentionExpiresAt = new Date(
      Date.now() + retentionDays * 86400000,
    ).toISOString();

    const uploaded: string[] = [];
    try {
      for (const image of images) {
        const extension = image.file.type.split("/")[1];
        const path = `${visit.organization_id}/${visit.id}/${crypto.randomUUID()}.${extension}`;

        const { error: uploadError } = await db.storage
          .from("visitor-documents")
          .upload(path, image.file, {
            contentType: image.file.type,
            upsert: false,
          });
        if (uploadError) throw uploadError;
        uploaded.push(path);

        const { error: documentError } = await db
          .from("visitor_documents")
          .insert({
            organization_id: visit.organization_id,
            visit_id: visit.id,
            visitor_id: visitorId,
            storage_path: path,
            mime_type: image.file.type,
            size_bytes: image.file.size,
            document_type: image.type,
            ocr_confidence: values.ocrConfidence ?? null,
            retention_expires_at: retentionExpiresAt,
          });
        if (documentError) throw documentError;
      }
    } catch (uploadError) {
      // Ningún archivo debe quedar huérfano si falla a mitad del proceso.
      if (uploaded.length)
        await db.storage.from("visitor-documents").remove(uploaded);
      throw uploadError;
    }

    // Si el visitante rehace su registro, el pase anterior deja de servir.
    await db
      .from("qr_tokens")
      .update({ revoked_at: new Date().toISOString() })
      .eq("visit_id", visit.id)
      .is("revoked_at", null);

    const qrToken = randomBytes(32).toString("base64url");
    const hash = createHash("sha256").update(qrToken).digest("hex");
    const { error: tokenError } = await db.from("qr_tokens").insert({
      organization_id: visit.organization_id,
      visit_id: visit.id,
      token_hash: hash,
      token_hint: `••••${qrToken.slice(-4)}`,
      valid_from: new Date(
        new Date(visit.starts_at).getTime() - 60 * 60000,
      ).toISOString(),
      expires_at: new Date(
        new Date(visit.ends_at).getTime() + 12 * 3600000,
      ).toISOString(),
    });
    if (tokenError) throw tokenError;

    await db
      .from("visits")
      .update({
        visitor_id: visitorId,
        visitor_company: values.company,
        vehicle_plate: values.vehiclePlate || null,
        visitor_notes: values.visitorNotes || null,
        status: "pre_registered",
        consented_at: new Date().toISOString(),
        privacy_notice_version: settings?.privacy_notice_version ?? "mvp-1",
      })
      .eq("id", visit.id);

    await db
      .from("visit_invitations")
      .update({ completed_at: new Date().toISOString() })
      .eq("visit_id", visit.id);

    await db.from("audit_logs").insert([
      {
        organization_id: visit.organization_id,
        visit_id: visit.id,
        event_type: "document_uploaded",
        metadata: {
          sides: images.length,
          retention_days: retentionDays,
          document_type: values.documentType,
        },
      },
      {
        organization_id: visit.organization_id,
        visit_id: visit.id,
        event_type: "pre_registration_completed",
        metadata: {
          document_captured: true,
          ocr_confidence: values.ocrConfidence ?? null,
          ocr_verified: values.ocrVerified === "true",
          document_expires_at: values.documentExpiresAt ?? null,
        },
      },
      {
        organization_id: visit.organization_id,
        visit_id: visit.id,
        event_type: "qr_generated",
        metadata: {},
      },
    ]);

    const passUrl = `${appUrl()}/pass/${qrToken}`;
    const delivery = await sendPassEmail({
      to: values.email,
      visitorName: values.fullName,
      organizationName: resolved.organization_name,
      dateLabel: new Intl.DateTimeFormat("es-MX", {
        dateStyle: "full",
        timeStyle: "short",
      }).format(new Date(visit.starts_at)),
      passUrl,
    }).catch(() => ({ status: "failed" as const }));

    await db.from("notification_logs").insert({
      organization_id: visit.organization_id,
      visit_id: visit.id,
      channel: "email",
      recipient_masked: maskEmail(values.email),
      template: "visitor_pass",
      status: delivery.status,
    });

    return NextResponse.json(
      {
        visitId: visit.id,
        qrToken,
        passUrl,
        emailStatus: delivery.status,
        wallet: walletAvailability(),
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof z.ZodError)
      return NextResponse.json(
        {
          error: "Revisa los datos del formulario",
          issues: error.issues.map((issue) => issue.path.join(".")),
        },
        { status: 400 },
      );
    console.error("Public registration failed", error);
    return NextResponse.json(
      { error: "No fue posible completar tu registro" },
      { status: 500 },
    );
  }
}
