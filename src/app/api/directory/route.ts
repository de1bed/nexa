import { NextResponse } from "next/server";
import { requireApiContext } from "@/lib/server/session";
import { whatsappConfigured } from "@/lib/server/whatsapp";
import { serializeSettings, settingsColumns } from "@/lib/server/org-settings";
import { mapRequirement, requirementColumns } from "@/lib/server/requirements";

export const dynamic = "force-dynamic";

/**
 * Catálogo operativo de la organización activa: ubicaciones, anfitriones y
 * parámetros de acceso. Los formularios se construyen a partir de aquí, por lo
 * que no hay nombres ni sedes escritos en el código.
 */
export async function GET() {
  const guard = await requireApiContext();
  if (!guard.ok)
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  const { db, organizationId, organizationName, role, userId, displayName } =
    guard.context;

  const [
    { data: locations },
    { data: members },
    { data: settings },
    { data: me },
    { data: requirements },
  ] = await Promise.all([
      db
        .from("locations")
        .select("id,name,address,timezone,active")
        .eq("organization_id", organizationId)
        .eq("active", true)
        .order("name"),
      db
        .from("organization_members")
        .select(
          "profile_id,role,profile:profiles!organization_members_profile_id_fkey(full_name,email),department:departments(name)",
        )
        .eq("organization_id", organizationId)
        .eq("active", true)
        .in("role", ["superadmin", "admin", "host"]),
      db
        .from("organization_settings")
        .select(settingsColumns)
        .eq("organization_id", organizationId)
        .maybeSingle(),
      db
        .from("organization_members")
        .select("default_location_id")
        .eq("organization_id", organizationId)
        .eq("profile_id", userId)
        .maybeSingle(),
      db
        .from("organization_requirements")
        .select(requirementColumns)
        .eq("organization_id", organizationId)
        .eq("active", true)
        .order("sort_order")
        .order("created_at"),
    ]);

  const hosts = (members ?? [])
    .map((row) => {
      const profile = row.profile as unknown as {
        full_name?: string;
        email?: string;
      } | null;
      const department = row.department as unknown as { name?: string } | null;
      return {
        id: row.profile_id as string,
        name: profile?.full_name ?? "Anfitrión",
        email: profile?.email ?? "",
        department: department?.name ?? "",
        role: row.role as string,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, "es"));

  return NextResponse.json(
    {
      organization: { id: organizationId, name: organizationName },
      viewer: {
        id: userId,
        name: displayName,
        role,
        defaultLocationId: (me?.default_location_id as string | null) ?? null,
      },
      // Qué vías de envío tiene configurada esta instalación.
      channels: {
        email: Boolean(process.env.RESEND_API_KEY),
        whatsapp: whatsappConfigured(),
      },
      locations: locations ?? [],
      hosts,
      requirements: (requirements ?? []).map((row) =>
        mapRequirement(row as unknown as Record<string, unknown>),
      ),
      settings: serializeSettings(settings),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
