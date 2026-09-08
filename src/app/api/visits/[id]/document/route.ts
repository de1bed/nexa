import { NextResponse } from "next/server";
import { requireApiContext } from "@/lib/server/session";
import { writeAudit } from "@/lib/server/audit";
import { createAdminClient } from "@/lib/server/supabase-admin";

export const dynamic = "force-dynamic";

const SIDE_LABELS: Record<string, string> = {
  identity_front: "Frente",
  identity_back: "Reverso",
  manual_capture: "Captura en caseta",
};

/**
 * Entrega URLs firmadas y efímeras de la identificación.
 * El bucket es privado. Esta ruta autoriza en la aplicación y firma
 * la URL con el cliente de servicio, para que admin, anfitrión y
 * guardia vean el archivo sin pelearse con RLS de Storage.
 */
export async function GET(
  _request: Request,
  ctx: RouteContext<"/api/visits/[id]/document">,
) {
  const guard = await requireApiContext([
    "superadmin",
    "admin",
    "guard",
    "host",
  ]);
  if (!guard.ok)
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  const { db, organizationId, userId, role } = guard.context;

  const { id } = await ctx.params;

  if (role === "host") {
    const { data: visit } = await db
      .from("visits")
      .select("host_id")
      .eq("id", id)
      .eq("organization_id", organizationId)
      .maybeSingle();
    if (!visit || visit.host_id !== userId)
      return NextResponse.json(
        { error: "No tienes permiso para ver este documento" },
        { status: 403 },
      );
  }

  const { data: documents } = await db
    .from("visitor_documents")
    .select("id,storage_path,mime_type,document_type,retention_expires_at")
    .eq("visit_id", id)
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .order("created_at", { ascending: true });

  if (!documents?.length)
    return NextResponse.json(
      { error: "Esta visita no tiene identificación registrada" },
      { status: 404 },
    );

  const storage = createAdminClient();
  const signed = await Promise.all(
    documents.map(async (document) => {
      const { data } = await storage.storage
        .from("visitor-documents")
        .createSignedUrl(document.storage_path, 60);
      return data?.signedUrl
        ? {
            id: document.id,
            url: data.signedUrl,
            mimeType: document.mime_type,
            label:
              SIDE_LABELS[document.document_type as string] ??
              (document.document_type as string) ??
              "Identificación",
            retentionExpiresAt: document.retention_expires_at,
          }
        : null;
    }),
  );

  const available = signed.filter((item) => item !== null);
  if (available.length === 0)
    return NextResponse.json(
      { error: "No tienes permiso para ver este documento" },
      { status: 403 },
    );

  await writeAudit({
    organizationId,
    actorId: userId,
    visitId: id,
    eventType: "document_previewed",
    metadata: { role, documents: available.length },
  }).catch(() => undefined);

  return NextResponse.json(
    { documents: available, expiresInSeconds: 60 },
    { headers: { "Cache-Control": "no-store" } },
  );
}
