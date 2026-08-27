import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionContext } from "@/lib/server/session";
import { writeAudit } from "@/lib/server/audit";

const schema = z.object({
  visitorName: z.string().min(2).max(120),
  email: z.email().or(z.literal("")),
  company: z.string().min(2).max(120),
  hostName: z.string().min(2).max(120),
  location: z.string().min(2).max(160),
  purpose: z.string().min(2).max(160),
  consent: z.literal("true"),
  documentCaptured: z.enum(["true", "false"]),
});

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const input = schema.parse(
      Object.fromEntries([...form.entries()].filter(([, value]) => typeof value === "string")),
    );
    const document = form.get("document");
    if (
      document !== null &&
      (!(document instanceof File) ||
        !["image/jpeg", "image/png", "image/webp"].includes(document.type) ||
        document.size > 8388608)
    )
      return NextResponse.json({ error: "Documento no permitido" }, { status: 400 });
    const documentCaptured = document instanceof File && document.size > 0;
    const context = await getSessionContext();
    const { db, user, selected } = context;
    if (!user)
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    if (!selected)
      return NextResponse.json(
        { error: "Selecciona una organización" },
        { status: 409 },
      );
    if (!["guard", "admin", "superadmin"].includes(selected.role))
      return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });
    const [{ data: location }, { data: host }] = await Promise.all([
      db
        .from("locations")
        .select("id,name")
        .eq("organization_id", selected.organizationId)
        .eq("name", input.location)
        .eq("active", true)
        .single(),
      db
        .from("organization_members")
        .select(
          "profile_id,profile:profiles!organization_members_profile_id_fkey(full_name)",
        )
        .eq("organization_id", selected.organizationId)
        .eq("active", true)
        .in("role", ["host", "admin"]),
    ]);
    const hostRow = (host ?? []).find(
      (row) =>
        (row.profile as unknown as { full_name?: string } | null)?.full_name ===
        input.hostName,
    );
    if (!location || !hostRow)
      return NextResponse.json(
        { error: "Anfitrión o ubicación no disponible" },
        { status: 400 },
      );
    const { data: visitor, error: visitorError } = await db
      .from("visitors")
      .insert({
        organization_id: selected.organizationId,
        full_name: input.visitorName,
        email: input.email || null,
        company: input.company,
      })
      .select("id")
      .single();
    if (visitorError || !visitor) throw visitorError;
    const now = new Date();
    const { data: visit, error: visitError } = await db
      .from("visits")
      .insert({
        organization_id: selected.organizationId,
        location_id: location.id,
        visitor_id: visitor.id,
        host_id: hostRow.profile_id,
        status: "checked_in",
        origin: "guard_manual",
        purpose: input.purpose,
        visitor_company: input.company,
        starts_at: now.toISOString(),
        ends_at: new Date(now.getTime() + 3600000).toISOString(),
        checked_in_at: now.toISOString(),
        consented_at: now.toISOString(),
        privacy_notice_version: "mvp-1",
        created_by: user.id,
      })
      .select("id")
      .single();
    if (visitError || !visit) throw visitError;
    if (documentCaptured) {
      const path = `${selected.organizationId}/${visit.id}/${crypto.randomUUID()}.${document.type.split("/")[1]}`;
      const { error: uploadError } = await db.storage
        .from("visitor-documents")
        .upload(path, document, { contentType: document.type, upsert: false });
      if (uploadError) throw uploadError;
      const { data: settings } = await db
        .from("organization_settings")
        .select("document_retention_days")
        .eq("organization_id", selected.organizationId)
        .maybeSingle();
      const retentionDays = settings?.document_retention_days ?? 30;
      const { error: documentError } = await db.from("visitor_documents").insert({
        organization_id: selected.organizationId,
        visit_id: visit.id,
        visitor_id: visitor.id,
        storage_path: path,
        mime_type: document.type,
        size_bytes: document.size,
        document_type: "manual_capture",
        retention_expires_at: new Date(Date.now() + retentionDays * 86400000).toISOString(),
      });
      if (documentError) {
        await db.storage.from("visitor-documents").remove([path]);
        throw documentError;
      }
    }
    await db.from("access_events").insert({
      organization_id: selected.organizationId,
      visit_id: visit.id,
      location_id: location.id,
      actor_id: user.id,
      event_type: "manual_check_in",
      metadata: { document_captured: documentCaptured },
    });
    await writeAudit({
      organizationId: selected.organizationId,
      actorId: user.id,
      visitId: visit.id,
      eventType: "manual_check_in",
      metadata: { document_captured: documentCaptured },
    });
    return NextResponse.json(
      {
        visit: {
          id: visit.id,
          visitorName: input.visitorName,
          email: input.email,
          company: input.company,
          hostName: input.hostName,
          hostId: hostRow.profile_id,
          location: location.name,
          startsAt: now.toISOString(),
          endsAt: new Date(now.getTime() + 3600000).toISOString(),
          checkedInAt: now.toISOString(),
          purpose: input.purpose,
          status: "checked_in",
          origin: "guard_manual",
          documentCaptured,
          consentedAt: now.toISOString(),
        },
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof z.ZodError)
      return NextResponse.json(
        { error: "Datos inválidos", issues: error.issues },
        { status: 400 },
      );
    console.error("Manual visit failed", error);
    return NextResponse.json(
      { error: "No fue posible registrar el acceso" },
      { status: 500 },
    );
  }
}
