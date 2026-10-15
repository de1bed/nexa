import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiContext } from "@/lib/server/session";
import { boothSchema } from "@/lib/schemas";
import { writeAudit } from "@/lib/server/audit";
import { mapBooth, missingBoothSchema } from "@/lib/server/booths";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const guard = await requireApiContext(["superadmin", "admin"]);
  if (!guard.ok)
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  const { db, organizationId, userId } = guard.context;

  try {
    const input = boothSchema.parse(await request.json());
    const { data: location } = await db
      .from("locations")
      .select("id")
      .eq("id", input.locationId)
      .eq("organization_id", organizationId)
      .maybeSingle();
    if (!location)
      return NextResponse.json(
        { error: "La ubicación no está disponible" },
        { status: 404 },
      );

    const { data, error } = await db
      .from("booths")
      .insert({
        organization_id: organizationId,
        location_id: input.locationId,
        name: input.name,
        notes: input.notes ?? "",
      })
      .select("id,location_id,name,notes,active")
      .single();

    if (error?.code === "23505")
      return NextResponse.json(
        { error: "Ya existe una caseta con ese nombre en esta ubicación" },
        { status: 409 },
      );
    if (error && missingBoothSchema(error))
      return NextResponse.json(
        {
          error:
            "Las casetas todavía no están en la base de esta instalación.",
        },
        { status: 503 },
      );
    if (error || !data) throw error ?? new Error("booth");

    await writeAudit({
      organizationId,
      actorId: userId,
      eventType: "booth_created",
      metadata: { location_id: input.locationId, name: input.name },
    });

    return NextResponse.json({ booth: mapBooth(data) }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError)
      return NextResponse.json(
        { error: "Datos inválidos", issues: error.issues },
        { status: 400 },
      );
    console.error("Booth POST failed", error);
    return NextResponse.json(
      { error: "No fue posible crear la caseta" },
      { status: 500 },
    );
  }
}
