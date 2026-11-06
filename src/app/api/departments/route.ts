import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiContext } from "@/lib/server/session";
import { createAdminClient } from "@/lib/server/supabase-admin";
import { writeAudit } from "@/lib/server/audit";

export const dynamic = "force-dynamic";

export async function GET() {
  const guard = await requireApiContext(["superadmin", "admin", "host", "guard"]);
  if (!guard.ok)
    return NextResponse.json({ error: guard.error }, { status: guard.status });

  const { data, error } = await guard.context.db
    .from("departments")
    .select("id,name,active")
    .eq("organization_id", guard.context.organizationId)
    .order("name");
  if (error)
    return NextResponse.json({ error: "No fue posible cargar los departamentos" }, { status: 500 });
  return NextResponse.json({ departments: data ?? [] });
}

const createSchema = z.object({
  name: z.string().trim().min(2).max(80),
});

export async function POST(request: Request) {
  const guard = await requireApiContext(["superadmin", "admin"]);
  if (!guard.ok)
    return NextResponse.json({ error: guard.error }, { status: guard.status });

  try {
    const input = createSchema.parse(await request.json());
    const { data, error } = await guard.context.db
      .from("departments")
      .insert({
        organization_id: guard.context.organizationId,
        name: input.name,
      })
      .select("id,name,active")
      .single();
    if (error) throw error;
    return NextResponse.json({ department: data }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "No fue posible crear el departamento. Revisa que no exista ya." },
      { status: 400 },
    );
  }
}

const updateSchema = z.object({
  id: z.uuid(),
  name: z.string().trim().min(2).max(80).optional(),
  active: z.boolean().optional(),
});

export async function PATCH(request: Request) {
  const guard = await requireApiContext(["superadmin", "admin"]);
  if (!guard.ok)
    return NextResponse.json({ error: guard.error }, { status: guard.status });

  try {
    const input = updateSchema.parse(await request.json());
    const payload: Record<string, unknown> = {};
    if (input.name !== undefined) payload.name = input.name;
    if (input.active !== undefined) payload.active = input.active;
    const { data, error } = await guard.context.db
      .from("departments")
      .update(payload)
      .eq("id", input.id)
      .eq("organization_id", guard.context.organizationId)
      .select("id,name,active")
      .maybeSingle();
    if (error || !data) throw error ?? new Error("missing");
    return NextResponse.json({ department: data });
  } catch {
    return NextResponse.json({ error: "No fue posible actualizar el departamento" }, { status: 400 });
  }
}

/**
 * Elimina un departamento. Las personas que lo tenían quedan sin
 * departamento. Si una solicitud de acceso vieja todavía lo cita, se
 * desactiva en lugar de borrarse, para no perder ese historial.
 */
export async function DELETE(request: Request) {
  const guard = await requireApiContext(["superadmin", "admin"]);
  if (!guard.ok)
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  const { organizationId, userId } = guard.context;

  const id = new URL(request.url).searchParams.get("id") ?? "";
  if (!z.uuid().safeParse(id).success)
    return NextResponse.json({ error: "Departamento inválido" }, { status: 400 });

  const admin = createAdminClient();
  const { data: department } = await admin
    .from("departments")
    .select("id,name")
    .eq("id", id)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (!department)
    return NextResponse.json({ error: "Departamento no disponible" }, { status: 404 });

  const { error: clearError } = await admin
    .from("organization_members")
    .update({ department_id: null })
    .eq("organization_id", organizationId)
    .eq("department_id", id);
  if (clearError)
    return NextResponse.json(
      { error: "No fue posible eliminar el departamento" },
      { status: 500 },
    );

  const { error: deleteError } = await admin
    .from("departments")
    .delete()
    .eq("id", id)
    .eq("organization_id", organizationId);
  if (deleteError) {
    const { error: hideError } = await admin
      .from("departments")
      .update({ active: false })
      .eq("id", id)
      .eq("organization_id", organizationId);
    if (hideError)
      return NextResponse.json(
        { error: "No fue posible eliminar el departamento" },
        { status: 500 },
      );
  }

  await writeAudit({
    organizationId,
    actorId: userId,
    eventType: "department_deleted",
    metadata: { department_id: id, name: department.name },
  });

  return NextResponse.json({ ok: true });
}
