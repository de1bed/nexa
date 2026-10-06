import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiContext } from "@/lib/server/session";
import { writeAudit } from "@/lib/server/audit";
import { settingsSchema } from "@/lib/schemas";
import {
  parseVisitorFlow,
  requireIdentificationFromFlow,
} from "@/lib/visitor-flow";
import { serializeSettings, settingsColumns } from "@/lib/server/org-settings";

export const dynamic = "force-dynamic";

export async function GET() {
  const guard = await requireApiContext();
  if (!guard.ok)
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  const { db, organizationId } = guard.context;

  const { data } = await db
    .from("organization_settings")
    .select(settingsColumns)
    .eq("organization_id", organizationId)
    .maybeSingle();

  return NextResponse.json(
    { settings: serializeSettings(data) },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function PATCH(request: Request) {
  const guard = await requireApiContext(["superadmin", "admin"]);
  if (!guard.ok)
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  const { db, organizationId, userId } = guard.context;

  try {
    const input = settingsSchema.parse(await request.json());
    const visitorFlow = parseVisitorFlow(input.visitorFlow);
    const requireIdentification = requireIdentificationFromFlow(visitorFlow);

    const { data: current } = await db
      .from("organization_settings")
      .select(
        "privacy_notice,privacy_notice_version,document_retention_days,document_retention_unlimited",
      )
      .eq("organization_id", organizationId)
      .maybeSingle();

    // Cambiar el texto del aviso genera una versión nueva: el consentimiento
    // registrado en cada visita queda ligado a la versión que el visitante leyó.
    const noticeChanged =
      Boolean(current) && current!.privacy_notice !== input.privacyNotice;
    const version = noticeChanged
      ? `v${Date.now().toString(36)}`
      : (current?.privacy_notice_version ?? "mvp-1");

    const payload = {
      organization_id: organizationId,
      document_retention_days: input.documentRetentionDays,
      document_retention_unlimited: input.documentRetentionUnlimited,
      allow_document_preview_for_guards: input.allowDocumentPreviewForGuards,
      require_identification: requireIdentification,
      visitor_flow: visitorFlow,
      early_entry_minutes: input.earlyEntryMinutes,
      late_entry_minutes: input.lateEntryMinutes,
      privacy_notice: input.privacyNotice,
      privacy_notice_version: version,
    };

    const { error } = current
      ? await db
          .from("organization_settings")
          .update(payload)
          .eq("organization_id", organizationId)
      : await db.from("organization_settings").insert(payload);
    if (error) throw error;

    // Los documentos ya guardados siguen la política nueva: ilimitada les quita
    // la fecha de borrado; un plazo fijo se la pone a los que no tenían.
    const retentionChanged =
      !current ||
      current.document_retention_unlimited !== input.documentRetentionUnlimited ||
      current.document_retention_days !== input.documentRetentionDays;
    if (retentionChanged) {
      const { error: retentionError } = await db.rpc(
        "apply_document_retention",
        { p_org: organizationId },
      );
      if (retentionError) throw retentionError;
    }

    await writeAudit({
      organizationId,
      actorId: userId,
      eventType: "settings_modified",
      metadata: {
        document_retention_days: input.documentRetentionDays,
        document_retention_unlimited: input.documentRetentionUnlimited,
        guard_preview: input.allowDocumentPreviewForGuards,
        visitor_flow: visitorFlow,
        privacy_notice_version: version,
      },
    });

    return NextResponse.json({ ok: true, privacyNoticeVersion: version });
  } catch (error) {
    if (error instanceof z.ZodError)
      return NextResponse.json(
        { error: "Datos inválidos", issues: error.issues },
        { status: 400 },
      );
    console.error("Settings PATCH failed", error);
    return NextResponse.json(
      { error: "No fue posible guardar la configuración" },
      { status: 500 },
    );
  }
}
