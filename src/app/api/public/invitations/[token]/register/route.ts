import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/server/supabase-admin";
import { rateLimit } from "@/lib/server/rate-limit";
import { createHash, randomBytes } from "node:crypto";
import { sendPassEmail } from "@/lib/server/email";
const schema = z.object({
  fullName: z.string().min(2).max(120),
  email: z.email(),
  phone: z.string().min(7).max(30),
  company: z.string().min(2).max(120),
  documentType: z.string().max(40),
  documentNumber: z.string().max(80).optional(),
  vehiclePlate: z.string().max(20).optional(),
  visitorNotes: z.string().max(500).optional(),
  consent: z.literal("true"),
});
export async function POST(
  request: Request,
  ctx: RouteContext<"/api/public/invitations/[token]/register">,
) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0] ?? "local";
  const limit = rateLimit(`register:${ip}`, 5, 300000);
  if (!limit.allowed)
    return NextResponse.json({ error: "Intenta más tarde" }, { status: 429 });
  try {
    const { token } = await ctx.params;
    const form = await request.formData();
    const values = schema.parse(
      Object.fromEntries(
        [...form.entries()].filter(([, v]) => typeof v === "string"),
      ),
    );
    const image = form.get("document");
    if (
      !(image instanceof File) ||
      !["image/jpeg", "image/png", "image/webp"].includes(image.type) ||
      image.size > 8388608
    )
      return NextResponse.json(
        { error: "Documento no permitido" },
        { status: 400 },
      );
    const db = createAdminClient();
    const { data: resolvedRaw } = await db
      .rpc("resolve_invitation", { p_token: token })
      .single();
    const resolved = resolvedRaw as null | { state: string; visit_id: string };
    if (!resolved || resolved.state !== "active")
      return NextResponse.json(
        { error: "Enlace no disponible" },
        { status: 404 },
      );
    const { data: visit } = await db
      .from("visits")
      .select("id,organization_id,visitor_id,starts_at,ends_at")
      .eq("id", resolved.visit_id)
      .single();
    if (!visit)
      return NextResponse.json(
        { error: "Enlace no disponible" },
        { status: 404 },
      );
    const masked = values.documentNumber
      ? `•••• ${values.documentNumber.replace(/\s/g, "").slice(-4)}`
      : null;
    let visitorId = visit.visitor_id as string | null;
    if (visitorId) {
      const { error: visitorError } = await db
        .from("visitors")
        .update({
          full_name: values.fullName,
          email: values.email,
          phone: values.phone,
          company: values.company,
          document_type: values.documentType,
          document_number_masked: masked,
        })
        .eq("id", visitorId)
        .eq("organization_id", visit.organization_id);
      if (visitorError) throw visitorError;
    } else {
      const { data: visitor, error: visitorError } = await db
        .from("visitors")
        .insert({
          organization_id: visit.organization_id,
          full_name: values.fullName,
          email: values.email,
          phone: values.phone,
          company: values.company,
          document_type: values.documentType,
          document_number_masked: masked,
        })
        .select("id")
        .single();
      if (visitorError || !visitor) throw visitorError;
      visitorId = visitor.id;
    }
    const path = `${visit.organization_id}/${visit.id}/${crypto.randomUUID()}.${image.type.split("/")[1]}`;
    const { error: uploadError } = await db.storage
      .from("visitor-documents")
      .upload(path, image, { contentType: image.type, upsert: false });
    if (uploadError) throw uploadError;
    const { data: settings } = await db
      .from("organization_settings")
      .select("document_retention_days")
      .eq("organization_id", visit.organization_id)
      .maybeSingle();
    const retentionDays = settings?.document_retention_days ?? 30;
    await db.from("visitor_documents").insert({
      organization_id: visit.organization_id,
      visit_id: visit.id,
      visitor_id: visitorId,
      storage_path: path,
      mime_type: image.type,
      size_bytes: image.size,
      document_type: values.documentType,
      retention_expires_at: new Date(Date.now() + retentionDays * 86400000).toISOString(),
    });
    const qrToken = randomBytes(32).toString("base64url");
    const hash = createHash("sha256").update(qrToken).digest("hex");
    await db.from("qr_tokens").insert({
      organization_id: visit.organization_id,
      visit_id: visit.id,
      token_hash: hash,
      token_hint: `••••${qrToken.slice(-4)}`,
      valid_from: new Date(
        new Date(visit.starts_at).getTime() - 15 * 60000,
      ).toISOString(),
      expires_at: new Date(
        new Date(visit.ends_at).getTime() + 30 * 60000,
      ).toISOString(),
    });
    await db
      .from("visits")
      .update({
        visitor_id: visitorId,
        visitor_company: values.company,
        vehicle_plate: values.vehiclePlate || null,
        visitor_notes: values.visitorNotes || null,
        status: "pre_registered",
        consented_at: new Date().toISOString(),
        privacy_notice_version: "mvp-1",
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
        metadata: { mime_type: image.type, retention_days: retentionDays },
      },
      {
        organization_id: visit.organization_id,
        visit_id: visit.id,
        event_type: "ocr_processed",
        metadata: { provider: process.env.OCR_PROVIDER ?? "mock" },
      },
      {
        organization_id: visit.organization_id,
        visit_id: visit.id,
        event_type: "qr_generated",
        metadata: {},
      },
      {
        organization_id: visit.organization_id,
        visit_id: visit.id,
        event_type: "pre_registration_completed",
        metadata: { document_captured: true },
      },
    ]);
    const passUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/pass/${qrToken}`;
    const delivery = await sendPassEmail({
      to: values.email,
      visitorName: values.fullName,
      passUrl,
    }).catch(() => ({ status: "failed" as const }));
    await db
      .from("notification_logs")
      .insert({
        organization_id: visit.organization_id,
        visit_id: visit.id,
        channel: "email",
        recipient_masked: values.email.replace(/(^.).*(@.*$)/, "$1•••$2"),
        template: "visitor_pass",
        status: delivery.status,
      });
    return NextResponse.json({ visitId: visit.id, qrToken }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError)
      return NextResponse.json(
        {
          error: "Datos inválidos",
          issues: error.issues.map((i) => i.path.join(".")),
        },
        { status: 400 },
      );
    console.error("Public registration failed", error);
    return NextResponse.json(
      { error: "No fue posible completar el registro" },
      { status: 500 },
    );
  }
}
