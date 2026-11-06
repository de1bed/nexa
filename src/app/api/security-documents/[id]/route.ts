import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiContext } from "@/lib/server/session";
import { createAdminClient } from "@/lib/server/supabase-admin";
import { writeAudit } from "@/lib/server/audit";
import { signedSecurityUrl } from "@/lib/server/security-documents";

export const dynamic = "force-dynamic";

async function findDocument(id: string, organizationId: string) {
  if (!z.uuid().safeParse(id).success) return null;
  const { data } = await createAdminClient()
    .from("organization_security_documents")
    .select("id,title,storage_path,active")
    .eq("id", id)
    .eq("organization_id", organizationId)
    .maybeSingle();
  return data;
}

/** La administración revisa el documento tal como lo verá el visitante. */
export async function GET(
  _request: Request,
  ctx: RouteContext<"/api/security-documents/[id]">,
) {
  const guard = await requireApiContext(["superadmin", "admin"]);
  if (!guard.ok)
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  const { id } = await ctx.params;
  const document = await findDocument(id, guard.context.organizationId);
  if (!document)
    return NextResponse.json({ error: "Documento no disponible" }, { status: 404 });
  const url = await signedSecurityUrl(createAdminClient(), document.storage_path as string);
  if (!url)
    return NextResponse.json({ error: "Documento no disponible" }, { status: 404 });
  return NextResponse.redirect(url, 303);
}

/**
 * Lo retira de las invitaciones. El archivo se conserva: las visitas que ya lo
 * aceptaron siguen apuntando a lo que leyeron.
 */
export async function DELETE(
  _request: Request,
  ctx: RouteContext<"/api/security-documents/[id]">,
) {
  const guard = await requireApiContext(["superadmin", "admin"]);
  if (!guard.ok)
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  const { organizationId, userId } = guard.context;
  const { id } = await ctx.params;
  const document = await findDocument(id, organizationId);
  if (!document)
    return NextResponse.json({ error: "Documento no disponible" }, { status: 404 });

  const { error } = await createAdminClient()
    .from("organization_security_documents")
    .update({ active: false })
    .eq("id", id)
    .eq("organization_id", organizationId);
  if (error)
    return NextResponse.json(
      { error: "No fue posible retirar el documento" },
      { status: 500 },
    );

  await writeAudit({
    organizationId,
    actorId: userId,
    eventType: "security_document_removed",
    metadata: { document_id: id, title: document.title },
  });
  return NextResponse.json({ ok: true });
}
