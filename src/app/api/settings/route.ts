import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiContext } from "@/lib/server/session";
import { writeAudit } from "@/lib/server/audit";
import { settingsSchema } from "@/lib/schemas";

export const dynamic = "force-dynamic";

const columns =
  "document_retention_days,allow_document_preview_for_guards,require_identification,early_entry_minutes,late_entry_minutes,privacy_notice,privacy_notice_version";

export async function GET() {
  const guard = await requireApiContext();
  if (!guard.ok)
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  const { db, organizationId } = guard.context;

  const { data } = await db
    .from("organization_settings")
    .select(columns)
    .eq("organization_id", organizationId)
    .maybeSingle();

  return NextResponse.json(
    {
      settings: {
        documentRetentionDays: data?.document_retention_days ?? 30,
        allowDocumentPreviewForGuards:
          data?.allow_document_preview_for_guards ?? false,
        requireIdentification: data?.require_identification ?? true,
        earlyEntryMinutes: data?.early_entry_minutes ?? 15,
        lateEntryMinutes: data?.late_entry_minutes ?? 30,
        privacyNotice: data?.privacy_notice ?? "",
        privacyNoticeVersion: data?.privacy_notice_version ?? "mvp-1",
      },
    },
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

    const { data: current } = await db
      .from("organization_settings")
      .select("privacy_notice,privacy_notice_version")
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
      allow_document_preview_for_guards: input.allowDocumentPreviewForGuards,
      require_identification: input.requireIdentification,
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

    await writeAudit({
      organizationId,
      actorId: userId,
      eventType: "settings_modified",
      metadata: {
        document_retention_days: input.documentRetentionDays,
        guard_preview: input.allowDocumentPreviewForGuards,
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
