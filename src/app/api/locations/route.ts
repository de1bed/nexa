import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiContext } from "@/lib/server/session";
import { locationSchema } from "@/lib/schemas";
import { writeAudit } from "@/lib/server/audit";

export const dynamic = "force-dynamic";

export async function GET() {
  const guard = await requireApiContext();
  if (!guard.ok)
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  const { db, organizationId } = guard.context;

  const { data, error } = await db
    .from("locations")
    .select("id,name,address,timezone,active")
    .eq("organization_id", organizationId)
    .order("name");

  if (error)
    return NextResponse.json(
      { error: "No fue posible cargar las ubicaciones" },
      { status: 500 },
    );
  return NextResponse.json(
    { locations: data ?? [] },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(request: Request) {
  const guard = await requireApiContext(["superadmin", "admin"]);
  if (!guard.ok)
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  const { db, organizationId, userId } = guard.context;

  try {
    const input = locationSchema.parse(await request.json());
    const { data, error } = await db
      .from("locations")
      .insert({ organization_id: organizationId, ...input })
      .select("id,name,address,timezone,active")
      .single();

    if (error?.code === "23505")
      return NextResponse.json(
        { error: "Ya existe una ubicación con ese nombre" },
        { status: 409 },
      );
    if (error) throw error;

    await writeAudit({
      organizationId,
      actorId: userId,
      eventType: "location_created",
      metadata: { name: input.name },
    });

    return NextResponse.json({ location: data }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError)
      return NextResponse.json(
        { error: "Datos inválidos", issues: error.issues },
        { status: 400 },
      );
    console.error("Location POST failed", error);
    return NextResponse.json(
      { error: "No fue posible crear la ubicación" },
      { status: 500 },
    );
  }
}
