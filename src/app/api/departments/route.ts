import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiContext } from "@/lib/server/session";

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
    return NextResponse.json({ error: "No fue posible cargar las áreas" }, { status: 500 });
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
      { error: "No fue posible crear el área. Revisa que no exista ya." },
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
    return NextResponse.json({ error: "No fue posible actualizar el área" }, { status: 400 });
  }
}
