import { NextResponse } from "next/server";
import { requireApiContext } from "@/lib/server/session";
import { whatsappConfigured } from "@/lib/server/whatsapp";

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

  const [{ data: locations }, { data: members }, { data: settings }] =
    await Promise.all([
      db
        .from("locations")
        .select("id,name,address,timezone,active")
        .eq("organization_id", organizationId)
        .eq("active", true)
        .order("name"),
      db
        .from("organization_members")
        .select(
          "profile_id,role,profile:profiles!organization_members_profile_id_fkey(full_name,email)",
        )
        .eq("organization_id", organizationId)
        .eq("active", true)
        .in("role", ["superadmin", "admin", "host"]),
      db
        .from("organization_settings")
        .select(
          "document_retention_days,allow_document_preview_for_guards,require_identification,early_entry_minutes,late_entry_minutes,privacy_notice,privacy_notice_version",
        )
        .eq("organization_id", organizationId)
        .maybeSingle(),
    ]);

  const hosts = (members ?? [])
    .map((row) => {
      const profile = row.profile as unknown as {
        full_name?: string;
        email?: string;
      } | null;
      return {
        id: row.profile_id as string,
        name: profile?.full_name ?? "Anfitrión",
        email: profile?.email ?? "",
        role: row.role as string,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, "es"));

  return NextResponse.json(
    {
      organization: { id: organizationId, name: organizationName },
      viewer: { id: userId, name: displayName, role },
      // Qué vías de envío tiene configurada esta instalación.
      channels: {
        email: Boolean(process.env.RESEND_API_KEY),
        whatsapp: whatsappConfigured(),
      },
      locations: locations ?? [],
      hosts,
      settings: {
        documentRetentionDays: settings?.document_retention_days ?? 30,
        allowDocumentPreviewForGuards:
          settings?.allow_document_preview_for_guards ?? false,
        requireIdentification: settings?.require_identification ?? true,
        earlyEntryMinutes: settings?.early_entry_minutes ?? 15,
        lateEntryMinutes: settings?.late_entry_minutes ?? 30,
        privacyNotice: settings?.privacy_notice ?? "",
        privacyNoticeVersion: settings?.privacy_notice_version ?? "mvp-1",
      },
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
