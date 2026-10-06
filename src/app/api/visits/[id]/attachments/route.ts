import { NextResponse } from "next/server";
import { requireApiContext } from "@/lib/server/session";
import { attachmentColumns, mapAttachment } from "@/lib/server/requirements";

export const dynamic = "force-dynamic";

/**
 * Anexos de una visita: requisitos pedidos y lo que agregó el visitante.
 * RLS limita la lectura a administración, caseta y el anfitrión de la visita.
 * Las fotos se ven con la ruta de documentos (URL firmada y auditada).
 */
export async function GET(
  _request: Request,
  ctx: RouteContext<"/api/visits/[id]/attachments">,
) {
  const guard = await requireApiContext();
  if (!guard.ok)
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  const { db, organizationId } = guard.context;
  const { id } = await ctx.params;

  const { data, error } = await db
    .from("visit_attachments")
    .select(attachmentColumns)
    .eq("visit_id", id)
    .eq("organization_id", organizationId)
    .order("sort_order");

  if (error)
    return NextResponse.json(
      { error: "No fue posible cargar los anexos" },
      { status: 500 },
    );

  return NextResponse.json(
    {
      attachments: (data ?? []).map((row) =>
        mapAttachment(row as unknown as Record<string, unknown>),
      ),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
