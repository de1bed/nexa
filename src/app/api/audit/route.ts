import { NextResponse } from "next/server";
import { requireApiContext } from "@/lib/server/session";

export const dynamic = "force-dynamic";

export async function GET() {
  const guard = await requireApiContext(["superadmin", "admin"]);
  if (!guard.ok)
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  const { db, organizationId } = guard.context;

  const { data, error } = await db
    .from("audit_logs")
    .select(
      "id,event_type,metadata,created_at,actor:profiles!audit_logs_actor_id_fkey(full_name)",
    )
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    console.error("Audit list failed", error);
    return NextResponse.json(
      { error: "No fue posible leer los cambios" },
      { status: 500 },
    );
  }

  const changes = (data ?? []).map((row) => {
    const actor = Array.isArray(row.actor) ? row.actor[0] : row.actor;
    const metadata = (row.metadata ?? {}) as Record<string, unknown>;
    const name = [metadata.booth_name, metadata.name].find(
      (value) => typeof value === "string",
    ) as string | undefined;
    return {
      id: String(row.id),
      at: String(row.created_at),
      actor: actor?.full_name || "Sistema",
      eventType: String(row.event_type),
      name,
      reason: typeof metadata.reason === "string" ? metadata.reason : undefined,
    };
  });

  return NextResponse.json(
    { changes },
    { headers: { "Cache-Control": "no-store" } },
  );
}
