import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiContext } from "@/lib/server/session";

export const dynamic = "force-dynamic";

export async function GET() {
  const guard = await requireApiContext(["superadmin", "admin"]);
  if (!guard.ok)
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  const { db, organizationId } = guard.context;

  const [{ data: requests }, { data: accessKey }] = await Promise.all([
    db
      .from("access_requests")
      .select(
        "id,requested_role,status,created_at,department_id,profile:profiles!access_requests_profile_id_fkey(full_name,email),department:departments(name)",
      )
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false }),
    db.rpc("organization_access_key", { p_org: organizationId }),
  ]);

  return NextResponse.json({
    accessKey: (accessKey as string | null) ?? "",
    requests: (requests ?? []).map((row) => {
      const profile = row.profile as unknown as {
        full_name?: string;
        email?: string;
      } | null;
      const department = row.department as unknown as { name?: string } | null;
      return {
        id: row.id as string,
        role: row.requested_role as string,
        status: row.status as string,
        createdAt: row.created_at as string,
        departmentId: (row.department_id as string | null) ?? null,
        department: department?.name ?? "",
        name: profile?.full_name ?? "Persona",
        email: profile?.email ?? "",
      };
    }),
  });
}

const reviewSchema = z.object({
  id: z.uuid(),
  decision: z.enum(["approve", "reject"]),
  role: z.enum(["admin", "host", "guard"]).optional(),
  departmentId: z.uuid().nullable().optional(),
});

export async function POST(request: Request) {
  const guard = await requireApiContext(["superadmin", "admin"]);
  if (!guard.ok)
    return NextResponse.json({ error: guard.error }, { status: guard.status });

  try {
    const input = reviewSchema.parse(await request.json());
    const { data, error } = await guard.context.db.rpc("review_access_request", {
      p_request: input.id,
      p_decision: input.decision,
      p_role: input.role ?? null,
      p_department: input.departmentId ?? null,
    });
    if (error) throw error;
    const result = data as { state?: string };
    if (result?.state === "forbidden")
      return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });
    if (result?.state === "missing")
      return NextResponse.json({ error: "La solicitud ya no está" }, { status: 404 });
    return NextResponse.json(result);
  } catch {
    return NextResponse.json(
      { error: "No fue posible actualizar la solicitud" },
      { status: 400 },
    );
  }
}
