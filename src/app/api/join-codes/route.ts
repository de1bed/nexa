import { NextResponse } from "next/server";
import { requireApiContext } from "@/lib/server/session";
import { writeAudit } from "@/lib/server/audit";

export const dynamic = "force-dynamic";

export async function GET() {
  const guard = await requireApiContext(["superadmin", "admin"]);
  if (!guard.ok)
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  const { db, organizationId } = guard.context;

  const { data, error } = await db
    .from("organization_join_codes")
    .select("id,code,role,uses_remaining,expires_at,created_at,created_by")
    .eq("organization_id", organizationId)
    .is("revoked_at", null)
    .order("created_at", { ascending: false });

  if (error)
    return NextResponse.json(
      { error: "No fue posible cargar los códigos" },
      { status: 500 },
    );

  return NextResponse.json(
    { codes: data ?? [] },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST() {
  return NextResponse.json(
    { error: "El acceso es solo por invitación. Invita por correo." },
    { status: 403 },
  );
}

export async function DELETE(request: Request) {
  const guard = await requireApiContext(["superadmin", "admin"]);
  if (!guard.ok)
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  const { db, organizationId, userId } = guard.context;

  try {
    const { codeId } = (await request.json()) as { codeId: string };
    if (!codeId) throw new Error("Código no especificado");

    const { error } = await db
      .from("organization_join_codes")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", codeId)
      .eq("organization_id", organizationId);

    if (error) throw error;

    await writeAudit({
      organizationId,
      actorId: userId,
      eventType: "join_code_revoked",
      metadata: { code_id: codeId },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Join code DELETE failed", error);
    return NextResponse.json(
      { error: "No fue posible revocar el código" },
      { status: 500 },
    );
  }
}
