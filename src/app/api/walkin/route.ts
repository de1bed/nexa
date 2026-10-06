import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiContext } from "@/lib/server/session";
import { writeAudit } from "@/lib/server/audit";
import {
  logoPublicUrl,
  newWalkinCode,
  newWalkinToken,
  pointColumns,
  toView,
  type PointRow,
} from "@/lib/server/walkin";

export const dynamic = "force-dynamic";

/** Puntos de autorregistro de la empresa (uno por sede) y su logo. */
export async function GET() {
  const guard = await requireApiContext(["superadmin", "admin"]);
  if (!guard.ok)
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  const { db, organizationId } = guard.context;

  const [{ data: points, error }, { data: organization }] = await Promise.all([
    db
      .from("walkin_points")
      .select(pointColumns)
      .eq("organization_id", organizationId),
    db
      .from("organizations")
      .select("logo_path")
      .eq("id", organizationId)
      .maybeSingle(),
  ]);

  if (error)
    return NextResponse.json(
      { error: "No fue posible cargar los QR de recepción" },
      { status: 500 },
    );

  return NextResponse.json(
    {
      points: (points ?? []).map((row) => toView(row as PointRow)),
      logoUrl: logoPublicUrl(organization?.logo_path as string | null),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

const createSchema = z.object({ locationId: z.uuid() });

export async function POST(request: Request) {
  const guard = await requireApiContext(["superadmin", "admin"]);
  if (!guard.ok)
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  const { db, organizationId, userId } = guard.context;

  try {
    const { locationId } = createSchema.parse(await request.json());

    const { data: location } = await db
      .from("locations")
      .select("id")
      .eq("id", locationId)
      .eq("organization_id", organizationId)
      .eq("active", true)
      .maybeSingle();
    if (!location)
      return NextResponse.json(
        { error: "La sede no está disponible" },
        { status: 400 },
      );

    const { data, error } = await db
      .from("walkin_points")
      .insert({
        organization_id: organizationId,
        location_id: locationId,
        public_token: newWalkinToken(),
        access_code: newWalkinCode(),
        created_by: userId,
      })
      .select(pointColumns)
      .single();
    if (error?.code === "23505")
      return NextResponse.json(
        { error: "Esta sede ya tiene su QR de recepción" },
        { status: 409 },
      );
    if (error || !data) throw error ?? new Error("insert failed");

    await writeAudit({
      organizationId,
      actorId: userId,
      eventType: "walkin_point_created",
      metadata: { location_id: locationId },
    });

    return NextResponse.json({ point: toView(data as PointRow) }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError)
      return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
    console.error("Walk-in POST failed", error);
    return NextResponse.json(
      { error: "No fue posible crear el QR de recepción" },
      { status: 500 },
    );
  }
}
