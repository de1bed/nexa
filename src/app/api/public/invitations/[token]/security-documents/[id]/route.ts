import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/server/supabase-admin";
import { rateLimit, requestOrigin } from "@/lib/server/rate-limit";
import { signedSecurityUrl } from "@/lib/server/security-documents";

export const dynamic = "force-dynamic";

/**
 * El visitante abre un documento de seguridad desde su invitación.
 * El enlace de la invitación es la llave. Queda registrado cuándo lo abrió.
 */
export async function GET(
  request: Request,
  ctx: RouteContext<"/api/public/invitations/[token]/security-documents/[id]">,
) {
  const limit = rateLimit(`security-doc:${requestOrigin(request)}`, 30, 60000);
  if (!limit.allowed)
    return NextResponse.json(
      { error: "Demasiados intentos" },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter) } },
    );

  const { token, id } = await ctx.params;
  if (!z.uuid().safeParse(id).success)
    return NextResponse.json({ error: "Documento no disponible" }, { status: 404 });

  const db = createAdminClient();
  const { data: invitation } = await db
    .rpc("resolve_invitation", { p_token: token })
    .maybeSingle();
  const visitId = (invitation as { visit_id?: string } | null)?.visit_id;
  if (!visitId)
    return NextResponse.json({ error: "Enlace no disponible" }, { status: 404 });

  const { data: visit } = await db
    .from("visits")
    .select("id,organization_id")
    .eq("id", visitId)
    .maybeSingle();
  if (!visit)
    return NextResponse.json({ error: "Enlace no disponible" }, { status: 404 });

  const { data: document } = await db
    .from("organization_security_documents")
    .select("id,title,storage_path")
    .eq("id", id)
    .eq("organization_id", visit.organization_id)
    .eq("active", true)
    .maybeSingle();
  if (!document)
    return NextResponse.json({ error: "Documento no disponible" }, { status: 404 });

  // Constancia de que lo recibió. Si ya lo había abierto, se conserva la primera vez.
  const { data: existing } = await db
    .from("visit_security_acceptances")
    .select("id,opened_at")
    .eq("visit_id", visit.id)
    .eq("document_id", document.id)
    .maybeSingle();
  if (!existing) {
    await db.from("visit_security_acceptances").insert({
      organization_id: visit.organization_id,
      visit_id: visit.id,
      document_id: document.id,
      document_title: document.title,
      opened_at: new Date().toISOString(),
    });
  } else if (!existing.opened_at) {
    await db
      .from("visit_security_acceptances")
      .update({ opened_at: new Date().toISOString() })
      .eq("id", existing.id);
  }

  const url = await signedSecurityUrl(db, document.storage_path as string);
  if (!url)
    return NextResponse.json({ error: "Documento no disponible" }, { status: 404 });
  return NextResponse.redirect(url, 303);
}
