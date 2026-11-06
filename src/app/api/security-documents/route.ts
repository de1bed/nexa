import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { requireApiContext } from "@/lib/server/session";
import { createAdminClient } from "@/lib/server/supabase-admin";
import { writeAudit } from "@/lib/server/audit";
import {
  MAX_SECURITY_BYTES,
  SECURITY_BUCKET,
  SECURITY_TYPES,
  listSecurityDocuments,
  missingSecuritySchema,
} from "@/lib/server/security-documents";

export const dynamic = "force-dynamic";

export async function GET() {
  const guard = await requireApiContext(["superadmin", "admin"]);
  if (!guard.ok)
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  const documents = await listSecurityDocuments(
    guard.context.db,
    guard.context.organizationId,
  );
  return NextResponse.json({ documents }, { headers: { "Cache-Control": "no-store" } });
}

/** Sube un documento de seguridad (PDF o imagen) para los visitantes. */
export async function POST(request: Request) {
  const guard = await requireApiContext(["superadmin", "admin"]);
  if (!guard.ok)
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  const { organizationId, userId } = guard.context;

  const form = await request.formData();
  const file = form.get("file");
  const title = String(form.get("title") ?? "").trim().slice(0, 120);
  if (title.length < 2)
    return NextResponse.json({ error: "Escribe un título para el documento" }, { status: 400 });
  if (!(file instanceof File) || file.size === 0)
    return NextResponse.json({ error: "Elige un archivo" }, { status: 400 });
  const extension = SECURITY_TYPES[file.type.toLowerCase()];
  if (!extension)
    return NextResponse.json(
      { error: "El documento debe ser PDF, PNG, JPG o WebP" },
      { status: 400 },
    );
  if (file.size > MAX_SECURITY_BYTES)
    return NextResponse.json(
      { error: "El documento debe pesar menos de 10 MB" },
      { status: 400 },
    );

  const admin = createAdminClient();
  const path = `${organizationId}/${randomUUID()}.${extension}`;
  const { error: uploadError } = await admin.storage
    .from(SECURITY_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });
  if (uploadError) {
    console.error("Security document upload failed", uploadError);
    return NextResponse.json(
      { error: "No fue posible subir el documento" },
      { status: 500 },
    );
  }

  const { data, error } = await admin
    .from("organization_security_documents")
    .insert({
      organization_id: organizationId,
      title,
      storage_path: path,
      mime_type: file.type.toLowerCase(),
      size_bytes: file.size,
      created_by: userId,
    })
    .select("id,title,mime_type,size_bytes,created_at")
    .single();
  if (error || !data) {
    await admin.storage.from(SECURITY_BUCKET).remove([path]);
    return NextResponse.json(
      {
        error: missingSecuritySchema(error)
          ? "Falta aplicar la migración de documentos de seguridad en la base."
          : "No fue posible guardar el documento",
      },
      { status: missingSecuritySchema(error) ? 503 : 500 },
    );
  }

  await writeAudit({
    organizationId,
    actorId: userId,
    eventType: "security_document_added",
    metadata: { document_id: data.id, title },
  });

  return NextResponse.json(
    {
      document: {
        id: data.id,
        title: data.title,
        mimeType: data.mime_type,
        sizeBytes: data.size_bytes,
        createdAt: data.created_at,
      },
    },
    { status: 201 },
  );
}
