import { NextResponse } from "next/server";
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

export async function POST() {
  return NextResponse.json(
    { error: "El acceso es solo por invitación. Invítalos por correo." },
    { status: 403 },
  );
}
