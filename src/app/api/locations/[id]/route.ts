import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionContext } from "@/lib/server/session";
export async function PATCH(
  request: Request,
  ctx: RouteContext<"/api/locations/[id]">,
) {
  try {
    const input = z.object({ active: z.boolean() }).parse(await request.json());
    const { id } = await ctx.params;
    const context = await getSessionContext();
    if (!context.user)
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    if (
      !context.selected ||
      !["admin", "superadmin"].includes(context.selected.role)
    )
      return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });
    const { data, error } = await context.db
      .from("locations")
      .update(input)
      .eq("id", id)
      .eq("organization_id", context.selected.organizationId)
      .select("id,active")
      .single();
    if (error || !data)
      return NextResponse.json(
        { error: "Ubicación no disponible" },
        { status: 404 },
      );
    return NextResponse.json({ location: data });
  } catch (error) {
    if (error instanceof z.ZodError)
      return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
    return NextResponse.json(
      { error: "No fue posible actualizar" },
      { status: 500 },
    );
  }
}
