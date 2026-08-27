import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionContext } from "@/lib/server/session";
import { writeAudit } from "@/lib/server/audit";
const schema = z.object({
  documentRetentionDays: z.number().int().min(1).max(365),
  allowDocumentPreviewForGuards: z.boolean(),
});
export async function GET() {
  const context = await getSessionContext();
  if (!context.user)
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  if (!context.selected)
    return NextResponse.json(
      { error: "Selecciona una organización" },
      { status: 409 },
    );
  const { data, error } = await context.db
    .from("organization_settings")
    .select(
      "document_retention_days,allow_document_preview_for_guards,privacy_notice_version",
    )
    .eq("organization_id", context.selected.organizationId)
    .single();
  if (error)
    return NextResponse.json(
      { error: "Configuración no disponible" },
      { status: 404 },
    );
  return NextResponse.json({
    settings: {
      documentRetentionDays: data.document_retention_days,
      allowDocumentPreviewForGuards: data.allow_document_preview_for_guards,
      privacyNoticeVersion: data.privacy_notice_version,
    },
  });
}
export async function PATCH(request: Request) {
  try {
    const input = schema.parse(await request.json());
    const context = await getSessionContext();
    if (!context.user)
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    if (
      !context.selected ||
      !["admin", "superadmin"].includes(context.selected.role)
    )
      return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });
    const { error } = await context.db
      .from("organization_settings")
      .update({
        document_retention_days: input.documentRetentionDays,
        allow_document_preview_for_guards: input.allowDocumentPreviewForGuards,
      })
      .eq("organization_id", context.selected.organizationId);
    if (error) throw error;
    await writeAudit({
      organizationId: context.selected.organizationId,
      actorId: context.user.id,
      eventType: "settings_modified",
      metadata: {
        document_retention_days: input.documentRetentionDays,
        guard_preview: input.allowDocumentPreviewForGuards,
      },
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError)
      return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
    return NextResponse.json(
      { error: "No fue posible guardar" },
      { status: 500 },
    );
  }
}
