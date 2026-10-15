import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiContext } from "@/lib/server/session";
import { boothUpdateSchema } from "@/lib/schemas";
import { writeAudit } from "@/lib/server/audit";
import { mapBooth } from "@/lib/server/booths";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  ctx: RouteContext<"/api/booths/[id]">,
) {
  const guard = await requireApiContext(["superadmin", "admin"]);
  if (!guard.ok)
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  const { db, organizationId, userId } = guard.context;

  try {
    const { id } = await ctx.params;
    const input = boothUpdateSchema.parse(await request.json());
    if (Object.keys(input).length === 0)
      return NextResponse.json({ error: "Sin cambios" }, { status: 400 });

    const payload: Record<string, unknown> = {};
    if (input.name !== undefined) payload.name = input.name;
    if (input.notes !== undefined) payload.notes = input.notes;
    if (input.active !== undefined) payload.active = input.active;

    const { data, error } = await db
      .from("booths")
      .update(payload)
      .eq("id", id)
      .eq("organization_id", organizationId)
      .select("id,location_id,name,notes,active")
      .maybeSingle();

    if (error?.code === "23505")
      return NextResponse.json(
        { error: "Ya existe una caseta con ese nombre en esta ubicación" },
        { status: 409 },
      );
    if (error || !data)
      return NextResponse.json(
        { error: "Caseta no disponible" },
        { status: 404 },
      );

    await writeAudit({
      organizationId,
      actorId: userId,
      eventType: "booth_updated",
      metadata: { booth_id: id, ...input },
    });

    return NextResponse.json({ booth: mapBooth(data) });
  } catch (error) {
    if (error instanceof z.ZodError)
      return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
    return NextResponse.json(
      { error: "No fue posible actualizar la caseta" },
      { status: 500 },
    );
  }
}
