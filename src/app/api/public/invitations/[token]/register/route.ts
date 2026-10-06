import { NextResponse } from "next/server";
import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import { createAdminClient } from "@/lib/server/supabase-admin";
import { rateLimit, requestOrigin } from "@/lib/server/rate-limit";
import { sendPassEmail, type DeliveryResult } from "@/lib/server/email";
import { appUrl } from "@/lib/config";
import { maskDocument, maskEmail } from "@/lib/security";
import { walletAvailability } from "@/lib/server/wallet/config";
import {
  identityFileMeta,
  isAllowedIdentityUpload,
} from "@/lib/identity-file";
import { clampPassDays, passValidityWindow } from "@/lib/pass-window";
import { DEFAULT_RETENTION_DAYS, retentionExpiresAt } from "@/lib/retention";
import {
  attachmentHasContent,
  parseVisitorFlow,
  requestedComplete,
  resolvedVisitorName,
  validateRegistration,
} from "@/lib/visitor-flow";
import { localeFromCookieHeader } from "@/lib/i18n/types";
import { translate } from "@/lib/i18n/catalog";

export const dynamic = "force-dynamic";

const schema = z.object({
  fullName: z.string().trim().max(120).optional().default(""),
  email: z.string().trim().max(254).optional().default(""),
  phone: z.string().trim().max(30).optional().default(""),
  company: z.string().trim().max(120).optional().default(""),
  documentType: z.string().trim().max(40).optional(),
  documentNumber: z.string().trim().max(80).optional(),
  vehiclePlate: z.string().trim().max(20).optional(),
  visitorNotes: z.string().trim().max(500).optional(),
  ocrConfidence: z.coerce.number().min(0).max(100).optional(),
  ocrVerified: z.enum(["true", "false"]).optional(),
  documentExpiresAt: z.string().max(20).optional(),
  consent: z.enum(["true", "false"]).optional(),
  vehicleDeclined: z.enum(["true", "false"]).optional(),
  attachments: z.string().max(40000).optional(),
});

/**
 * Metadatos de cada anexo. Las fotos viajan aparte como
 * `attachmentPhoto:<key>`. `requestedId` liga la respuesta con un requisito
 * que la empresa pidió; sin él es un anexo libre del visitante.
 */
const attachmentMetaSchema = z
  .array(
    z.object({
      key: z.string().trim().min(1).max(64),
      requestedId: z.uuid().optional(),
      title: z.string().trim().max(120).default(""),
      text: z.string().trim().max(2000).default(""),
    }),
  )
  .max(40);

const MAX_PHOTOS_PER_ATTACHMENT = 5;
const MAX_FREE_ATTACHMENTS = 10;

const IDENTITY_SIDES = [
  { field: "documentFront", type: "identity_front" },
  { field: "documentBack", type: "identity_back" },
] as const;

function collectFiles(form: FormData, field: string) {
  return form
    .getAll(field)
    .filter((value): value is File => value instanceof File && value.size > 0);
}

export async function POST(
  request: Request,
  ctx: RouteContext<"/api/public/invitations/[token]/register">,
) {
  const locale = localeFromCookieHeader(request.headers.get("cookie"));
  const limit = rateLimit(`register:${requestOrigin(request)}`, 8, 300000);
  if (!limit.allowed)
    return NextResponse.json(
      { error: translate("errors.too_many", undefined, locale) },
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

    const identityImages: Array<{ file: File; type: string }> = [];
    for (const side of IDENTITY_SIDES) {
      const image = form.get(side.field);
      if (!(image instanceof File) || image.size === 0) continue;
      identityImages.push({ file: image, type: side.type });
    }

    // Si el visitante declaró que no trae vehículo, sus placas y fotos no se guardan.
    const vehicleDeclined = values.vehicleDeclined === "true";
    const vehicleImages = vehicleDeclined
      ? []
      : collectFiles(form, "vehiclePlatePhoto").map((file) => ({
          file,
          type: "vehicle_plate",
        }));
    const vehiclePlate = vehicleDeclined ? "" : (values.vehiclePlate ?? "");
    let rawAttachments: unknown = [];
    try {
      rawAttachments = JSON.parse(values.attachments || "[]");
    } catch {
      return NextResponse.json(
        { error: translate("errors.form_invalid", undefined, locale) },
        { status: 400 },
      );
    }
    const attachmentMeta = attachmentMetaSchema.parse(rawAttachments);
    const attachmentEntries = attachmentMeta.map((entry) => ({
      ...entry,
      photos: collectFiles(form, `attachmentPhoto:${entry.key}`).slice(
        0,
        MAX_PHOTOS_PER_ATTACHMENT,
      ),
    }));
    // Clientes anteriores mandaban fotos sueltas en `attachment`.
    const legacyPhotos = collectFiles(form, "attachment");
    if (legacyPhotos.length)
      attachmentEntries.push({
        key: "legacy",
        requestedId: undefined,
        title: "",
        text: "",
        photos: legacyPhotos.slice(0, MAX_PHOTOS_PER_ATTACHMENT),
      });
    const attachmentImages = attachmentEntries.flatMap((entry) =>
      entry.photos.map((file) => ({
        file,
        type: "attachment",
        attachmentKey: entry.key,
      })),
    );
    const images: Array<{ file: File; type: string; attachmentKey?: string }> =
      [...identityImages, ...vehicleImages, ...attachmentImages];

    for (const image of images) {
      if (!isAllowedIdentityUpload(image.file))
        return NextResponse.json(
          { error: translate("errors.image_type", undefined, locale) },
          { status: 400 },
        );
    }

    const db = createAdminClient();
    const { data: resolvedRow } = await db
      .rpc("resolve_invitation", { p_token: token })
      .maybeSingle();
    const resolved = resolvedRow as null | {
      state: string;
      visit_id: string;
      organization_name: string;
      visitor_name: string;
      visitor_flow: unknown;
      require_identification: boolean;
    };
    if (!resolved || resolved.state !== "active")
      return NextResponse.json(
        { error: translate("errors.link_unavailable", undefined, locale) },
        { status: 404 },
      );

    const { data: visit } = await db
      .from("visits")
      .select("id,organization_id,visitor_id,starts_at,ends_at,pass_valid_days")
      .eq("id", resolved.visit_id)
      .maybeSingle();
    if (!visit)
      return NextResponse.json(
        { error: translate("errors.link_unavailable", undefined, locale) },
        { status: 404 },
      );

    const { data: settings } = await db
      .from("organization_settings")
      .select(
        "document_retention_days,document_retention_unlimited,privacy_notice_version,require_identification,visitor_flow",
      )
      .eq("organization_id", visit.organization_id)
      .maybeSingle();

    const flow = parseVisitorFlow(
      settings?.visitor_flow ?? resolved.visitor_flow,
      settings?.require_identification !== false,
    );

    // Requisitos que la empresa pidió en esta visita y lo que respondió el visitante.
    const { data: requestedRows } = await db
      .from("visit_attachments")
      .select("id,ask_photo,ask_text,required")
      .eq("visit_id", visit.id)
      .eq("source", "requested");
    const requested = requestedRows ?? [];
    const answerFor = (id: string) =>
      attachmentEntries.find((entry) => entry.requestedId === id);
    const requirementsMissing = requested.some((item) => {
      const answer = answerFor(item.id);
      return !requestedComplete(
        {
          askPhoto: item.ask_photo,
          askText: item.ask_text,
          required: item.required,
        },
        { text: answer?.text ?? "", photos: answer?.photos.length ?? 0 },
      );
    });
    const freeEntries = attachmentEntries
      .filter((entry) => !entry.requestedId)
      .filter((entry) =>
        attachmentHasContent({ ...entry, photos: entry.photos.length }),
      )
      .slice(0, MAX_FREE_ATTACHMENTS);

    const problem = validateRegistration(
      {
        fullName: values.fullName,
        email: values.email,
        phone: values.phone,
        company: values.company,
        vehiclePlate,
        vehicleDeclined,
        visitorNotes: values.visitorNotes ?? "",
        consent: values.consent === "true",
        identityPhotos: identityImages.length,
        vehiclePhotos: vehicleImages.length,
        attachmentItems: freeEntries.length,
        requirementsMissing,
        invitedName: resolved.visitor_name,
      },
      flow,
    );
    if (problem)
      return NextResponse.json(
        { error: translate(`errors.${problem}`, undefined, locale), code: problem },
        { status: 400 },
      );

    const fullName = resolvedVisitorName(
      values.fullName,
      resolved.visitor_name,
      flow.identity,
    );
    const masked = values.documentNumber
      ? maskDocument(values.documentNumber)
      : null;

    const visitorPayload = {
      organization_id: visit.organization_id,
      full_name: fullName,
      email: values.email || null,
      phone: values.phone || null,
      company: values.company || null,
      document_type:
        values.documentType ||
        (identityImages.length ? "INE" : "No presentada"),
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

    // Anexos: un nuevo registro reemplaza lo que el visitante haya entregado antes.
    const now = new Date().toISOString();
    const attachmentIds = new Map<string, string>();
    const { error: clearError } = await db
      .from("visit_attachments")
      .delete()
      .eq("visit_id", visit.id)
      .eq("source", "visitor");
    if (clearError) throw clearError;

    for (const item of requested) {
      const answer = answerFor(item.id);
      const text = item.ask_text ? (answer?.text ?? "") : "";
      const photos = item.ask_photo ? (answer?.photos.length ?? 0) : 0;
      const { error } = await db
        .from("visit_attachments")
        .update({
          response_text: text || null,
          completed_at: text || photos ? now : null,
        })
        .eq("id", item.id);
      if (error) throw error;
      if (item.ask_photo) attachmentIds.set(item.id, item.id);
    }

    if (freeEntries.length) {
      const { data: inserted, error } = await db
        .from("visit_attachments")
        .insert(
          freeEntries.map((entry, index) => ({
            organization_id: visit.organization_id,
            visit_id: visit.id,
            source: "visitor",
            title: entry.title,
            description: "",
            ask_photo: true,
            ask_text: true,
            required: false,
            response_text: entry.text || null,
            sort_order: 100 + index,
            completed_at: now,
          })),
        )
        .select("id,sort_order");
      if (error) throw error;
      for (const row of inserted ?? []) {
        const entry = freeEntries[Number(row.sort_order) - 100];
        if (entry) attachmentIds.set(entry.key, row.id as string);
      }
    }

    // Solo se guardan fotos de anexos que existen y que piden foto.
    const storedImages = images.filter(
      (image) => !image.attachmentKey || attachmentIds.has(image.attachmentKey),
    );

    const retentionDays =
      settings?.document_retention_days ?? DEFAULT_RETENTION_DAYS;
    const retentionUnlimited = settings?.document_retention_unlimited !== false;
    const documentsExpireAt = retentionExpiresAt({
      unlimited: retentionUnlimited,
      days: retentionDays,
    });

    const uploaded: string[] = [];
    try {
      for (const image of storedImages) {
        const { mimeType, extension } = identityFileMeta(image.file);
        const path = `${visit.organization_id}/${visit.id}/${crypto.randomUUID()}.${extension}`;

        const { error: uploadError } = await db.storage
          .from("visitor-documents")
          .upload(path, image.file, {
            contentType: mimeType,
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
            mime_type: mimeType,
            size_bytes: image.file.size,
            document_type: image.type,
            attachment_id: image.attachmentKey
              ? (attachmentIds.get(image.attachmentKey) ?? null)
              : null,
            ocr_confidence: values.ocrConfidence ?? null,
            retention_expires_at: documentsExpireAt,
          });
        if (documentError) throw documentError;
      }
    } catch (uploadError) {
      if (uploaded.length)
        await db.storage.from("visitor-documents").remove(uploaded);
      throw uploadError;
    }

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
      public_token: qrToken,
      ...passValidityWindow({
        startsAt: String(visit.starts_at),
        endsAt: String(visit.ends_at),
        validDays: clampPassDays(visit.pass_valid_days),
      }),
    });
    if (tokenError) throw tokenError;

    const consented = values.consent === "true";
    await db
      .from("visits")
      .update({
        visitor_id: visitorId,
        visitor_company: values.company || null,
        vehicle_plate: vehiclePlate || null,
        vehicle_declined: vehicleDeclined,
        visitor_notes: values.visitorNotes || null,
        status: "pre_registered",
        consented_at: consented ? new Date().toISOString() : null,
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
          sides: storedImages.length,
          identity: identityImages.length,
          vehicle: vehicleImages.length,
          attachments: storedImages.length - identityImages.length - vehicleImages.length,
          requested: requested.length,
          free_attachments: freeEntries.length,
          retention_days: retentionUnlimited ? null : retentionDays,
          document_type: values.documentType,
        },
      },
      {
        organization_id: visit.organization_id,
        visit_id: visit.id,
        event_type: "pre_registration_completed",
        metadata: {
          document_captured: identityImages.length > 0,
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
    let delivery: DeliveryResult = { status: "development" };
    if (values.email) {
      delivery = await sendPassEmail({
        to: values.email,
        visitorName: fullName,
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
    }

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
          error: translate("errors.form_invalid", undefined, locale),
          issues: error.issues.map((issue) => issue.path.join(".")),
        },
        { status: 400 },
      );
    console.error("Public registration failed", error);
    return NextResponse.json(
      { error: translate("errors.register_failed", undefined, locale) },
      { status: 500 },
    );
  }
}
