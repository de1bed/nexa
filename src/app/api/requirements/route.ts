import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiContext } from "@/lib/server/session";
import { writeAudit } from "@/lib/server/audit";
import { requirementSchema } from "@/lib/schemas";
import { mapRequirement, requirementColumns } from "@/lib/server/requirements";

export const dynamic = "force-dynamic";

/** Catálogo de requisitos de la empresa. Lo lee todo el equipo; lo edita administración. */
export async function GET() {
  const guard = await requireApiContext();
  if (!guard.ok)
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  const { db, organizationId } = guard.context;

  const { data, error } = await db
    .from("organization_requirements")
    .select(requirementColumns)
    .eq("organization_id", organizationId)
    .eq("active", true)
    .order("sort_order")
    .order("created_at");

  if (error)
    return NextResponse.json(
      { error: "No fue posible cargar los requisitos" },
      { status: 500 },
    );

  return NextResponse.json(
    {
      requirements: (data ?? []).map((row) =>
        mapRequirement(row as unknown as Record<string, unknown>),
      ),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(request: Request) {
  const guard = await requireApiContext(["superadmin", "admin"]);
  if (!guard.ok)
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  const { db, organizationId, userId } = guard.context;

  try {
    const input = requirementSchema.parse(await request.json());

    const { count } = await db
      .from("organization_requirements")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("active", true);
    if ((count ?? 0) >= 30)
      return NextResponse.json(
        { error: "Llegaste al máximo de 30 requisitos" },
        { status: 409 },
      );

    const { data, error } = await db
      .from("organization_requirements")
      .insert({
        organization_id: organizationId,
        title: input.title,
        description: input.description,
        ask_photo: input.askPhoto,
        ask_text: input.askText,
        required: input.required,
        apply_by_default: input.applyByDefault,
        sort_order: count ?? 0,
        created_by: userId,
      })
      .select(requirementColumns)
      .single();
    if (error || !data) throw error ?? new Error("insert failed");

    await writeAudit({
      organizationId,
      actorId: userId,
      eventType: "requirement_created",
      metadata: { requirement_id: (data as unknown as { id: string }).id },
    });

    return NextResponse.json(
      { requirement: mapRequirement(data as unknown as Record<string, unknown>) },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof z.ZodError)
      return NextResponse.json(
        { error: error.issues[0]?.message ?? "Datos inválidos" },
        { status: 400 },
      );
    console.error("Requirements POST failed", error);
    return NextResponse.json(
      { error: "No fue posible guardar el requisito" },
      { status: 500 },
    );
  }
}
