import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiContext } from "@/lib/server/session";
import { writeAudit } from "@/lib/server/audit";

export const dynamic = "force-dynamic";

const schema = z.object({
  active: z.boolean().optional(),
  name: z.string().trim().min(2).max(120).optional(),
  address: z.string().trim().min(5).max(300).optional(),
  timezone: z.string().trim().min(3).max(80).optional(),
});

export async function PATCH(
  request: Request,
  ctx: RouteContext<"/api/locations/[id]">,
) {
  const guard = await requireApiContext(["superadmin", "admin"]);
  if (!guard.ok)
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  const { db, organizationId, userId } = guard.context;

  try {
    const { id } = await ctx.params;
    const input = schema.parse(await request.json());
    if (Object.keys(input).length === 0)
      return NextResponse.json({ error: "Sin cambios" }, { status: 400 });

    // No se puede desactivar la última recepción operativa.
    if (input.active === false) {
      const { count } = await db
        .from("locations")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", organizationId)
        .eq("active", true);
      if ((count ?? 0) <= 1)
        return NextResponse.json(
          { error: "Debe quedar al menos una ubicación activa" },
          { status: 409 },
        );
    }

    const { timezone, ...rest } = input;
    if (timezone !== undefined) {
      // La zona pasa por la base: reinterpreta la hora escrita de las citas
      // pendientes para que 9:00 siga siendo 9:00 en la zona nueva.
      const { error: zoneError } = await db.rpc("set_location_timezone", {
        p_location_id: id,
        p_timezone: timezone,
      });
      if (zoneError)
        return NextResponse.json(
          { error: zoneError.message || "No fue posible cambiar la zona horaria" },
          { status: 400 },
        );
    }

    const columns = "id,name,address,timezone,active";
    const { data, error } =
      Object.keys(rest).length > 0
        ? await db
            .from("locations")
            .update(rest)
            .eq("id", id)
            .eq("organization_id", organizationId)
            .select(columns)
            .maybeSingle()
        : await db
            .from("locations")
            .select(columns)
            .eq("id", id)
            .eq("organization_id", organizationId)
            .maybeSingle();

    if (error || !data)
      return NextResponse.json(
        { error: "Ubicación no disponible" },
        { status: 404 },
      );

    await writeAudit({
      organizationId,
      actorId: userId,
      eventType: "location_updated",
      metadata: { location_id: id, ...input },
    });

    return NextResponse.json({ location: data });
  } catch (error) {
    if (error instanceof z.ZodError)
      return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
    return NextResponse.json(
      { error: "No fue posible actualizar la ubicación" },
      { status: 500 },
    );
  }
}
