import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/lib/server/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = request.headers.get("authorization") ?? "";
  const expected = Buffer.from(`Bearer ${secret}`);
  const received = Buffer.from(header);
  return (
    expected.length === received.length && timingSafeEqual(expected, received)
  );
}

/**
 * Retención: primero se elimina el objeto físico del bucket privado y solo
 * entonces se marca la fila. Ese orden garantiza que nunca queden archivos
 * huérfanos con la identificación de un visitante.
 */
export async function GET(request: NextRequest) {
  if (!authorized(request))
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const db = createAdminClient();

  const { data: expiredVisits } = await db.rpc("expire_stale_visits");

  const { data: documents, error } = await db
    .from("visitor_documents")
    .select("id,organization_id,visit_id,storage_path")
    .is("deleted_at", null)
    .lte("retention_expires_at", new Date().toISOString())
    .limit(500);

  if (error)
    return NextResponse.json(
      { error: "No fue posible consultar la retención" },
      { status: 500 },
    );

  let purged = 0;
  const failed: string[] = [];

  for (const document of documents ?? []) {
    const { error: storageError } = await db.storage
      .from("visitor-documents")
      .remove([document.storage_path]);
    if (storageError) {
      failed.push(document.id);
      continue;
    }

    const { error: updateError } = await db
      .from("visitor_documents")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", document.id)
      .is("deleted_at", null);
    if (updateError) {
      failed.push(document.id);
      continue;
    }

    await db.from("audit_logs").insert({
      organization_id: document.organization_id,
      visit_id: document.visit_id,
      event_type: "document_deleted",
      metadata: { reason: "retention_policy", document_id: document.id },
    });
    purged += 1;
  }

  return NextResponse.json({
    purged,
    failed: failed.length,
    failedIds: failed,
    expiredVisits: expiredVisits ?? 0,
    remaining: (documents?.length ?? 0) === 500,
  });
}
