import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionContext } from "@/lib/server/session";
const createSchema = z.object({
  name: z.string().min(2).max(120),
  address: z.string().min(5).max(300),
  timezone: z.string().min(3).max(80),
});
export async function GET() {
  const context = await getSessionContext();
  if (!context.user)
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  if (!context.selected)
    return NextResponse.json(
      { error: "Selecciona una organización" },
      { status: 409 },
    );
  const { data, error } = await context.db
    .from("locations")
    .select("id,name,address,timezone,active")
    .eq("organization_id", context.selected.organizationId)
    .order("name");
  if (error)
    return NextResponse.json(
      { error: "No fue posible cargar ubicaciones" },
      { status: 500 },
    );
  return NextResponse.json({ locations: data ?? [] });
}
export async function POST(request: Request) {
  try {
    const input = createSchema.parse(await request.json());
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
      .insert({ organization_id: context.selected.organizationId, ...input })
      .select("id,name,address,timezone,active")
      .single();
    if (error) throw error;
    return NextResponse.json({ location: data }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError)
      return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
    return NextResponse.json(
      { error: "No fue posible crear la ubicación" },
      { status: 500 },
    );
  }
}
