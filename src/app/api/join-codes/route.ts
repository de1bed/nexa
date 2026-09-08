import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiContext } from "@/lib/server/session";
import { writeAudit } from "@/lib/server/audit";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  role: z.enum(["host", "guard"]),
  usesLimit: z.number().int().min(1).max(100).optional(),
  expiresInDays: z.number().int().min(1).max(30).optional(),
});

function generateCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

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

export async function POST(request: Request) {
  const guard = await requireApiContext(["superadmin", "admin"]);
  if (!guard.ok)
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  const { db, organizationId, userId } = guard.context;

  try {
    const input = createSchema.parse(await request.json());

    const code = generateCode();
    const expiresAt = input.expiresInDays
      ? new Date(Date.now() + input.expiresInDays * 24 * 60 * 60 * 1000).toISOString()
      : null;

    const { data, error } = await db
      .from("organization_join_codes")
      .insert({
        organization_id: organizationId,
        code,
        role: input.role,
        uses_remaining: input.usesLimit ?? null,
        expires_at: expiresAt,
        created_by: userId,
      })
      .select("id,code,role,uses_remaining,expires_at,created_at")
      .single();

    if (error) throw error;

    await writeAudit({
      organizationId,
      actorId: userId,
      eventType: "join_code_created",
      metadata: { role: input.role, code_id: data.id },
    });

    return NextResponse.json({ code: data }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError)
      return NextResponse.json(
        { error: "Datos inválidos", issues: error.issues },
        { status: 400 },
      );
    console.error("Join code POST failed", error);
    return NextResponse.json(
      { error: "No fue posible crear el código" },
      { status: 500 },
    );
  }
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
