import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiContext } from "@/lib/server/session";
import { writeAudit } from "@/lib/server/audit";
import { mapVisit, visitSelect } from "@/lib/server/visit-mapper";

export const dynamic = "force-dynamic";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 8 * 1024 * 1024;

const schema = z.object({
  visitorName: z.string().trim().min(2).max(120),
  email: z.union([z.literal(""), z.email()]).default(""),
  phone: z.string().trim().max(30).default(""),
  company: z.string().trim().min(2).max(120),
  hostId: z.uuid("Anfitrión inválido"),
  locationId: z.uuid("Ubicación inválida"),
  purpose: z.string().trim().min(2).max(160),
  consent: z.literal("true"),
});

export async function POST(request: Request) {
  const guard = await requireApiContext(["superadmin", "admin", "guard"]);
  if (!guard.ok)
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  const { db, organizationId, userId } = guard.context;

  try {
    const form = await request.formData();
    const input = schema.parse(
      Object.fromEntries(
        [...form.entries()].filter(([, value]) => typeof value === "string"),
      ),
    );

    const document = form.get("document");
    const hasDocument = document instanceof File && document.size > 0;
    if (hasDocument) {
      if (!ALLOWED_TYPES.includes(document.type))
        return NextResponse.json(
          { error: "El documento debe ser JPG, PNG o WebP" },
          { status: 400 },
        );
      if (document.size > MAX_BYTES)
        return NextResponse.json(
          { error: "El documento supera 8 MB" },
          { status: 400 },
        );
    }

    const [{ data: location }, { data: host }] = await Promise.all([
      db
        .from("locations")
        .select("id")
        .eq("id", input.locationId)
        .eq("organization_id", organizationId)
        .eq("active", true)
        .maybeSingle(),
      db
        .from("organization_members")
        .select("profile_id")
        .eq("organization_id", organizationId)
        .eq("profile_id", input.hostId)
        .eq("active", true)
        .in("role", ["superadmin", "admin", "host"])
        .maybeSingle(),
    ]);
    if (!location)
      return NextResponse.json(
        { error: "La ubicación no está disponible" },
        { status: 400 },
      );
    if (!host)
      return NextResponse.json(
        { error: "El anfitrión no está disponible" },
        { status: 400 },
      );

    const { data: visitor, error: visitorError } = await db
      .from("visitors")
      .insert({
        organization_id: organizationId,
        full_name: input.visitorName,
        email: input.email || null,
        phone: input.phone || null,
        company: input.company,
      })
      .select("id")
      .single();
    if (visitorError || !visitor) throw visitorError ?? new Error("visitor");

    const now = new Date();
    const { data: created, error: visitError } = await db
      .from("visits")
      .insert({
        organization_id: organizationId,
        location_id: location.id,
        visitor_id: visitor.id,
        host_id: host.profile_id,
        status: "checked_in",
        origin: "guard_manual",
        purpose: input.purpose,
        visitor_company: input.company,
        starts_at: now.toISOString(),
        ends_at: new Date(now.getTime() + 3600000).toISOString(),
        checked_in_at: now.toISOString(),
        consented_at: now.toISOString(),
        privacy_notice_version: "mvp-1",
        created_by: userId,
      })
      .select("id")
      .single();
    if (visitError || !created) throw visitError ?? new Error("visit");

    if (hasDocument) {
      const extension = document.type.split("/")[1];
      const path = `${organizationId}/${created.id}/${crypto.randomUUID()}.${extension}`;
      const { error: uploadError } = await db.storage
        .from("visitor-documents")
        .upload(path, document, { contentType: document.type, upsert: false });
      if (uploadError) throw uploadError;

      const { data: settings } = await db
        .from("organization_settings")
        .select("document_retention_days")
        .eq("organization_id", organizationId)
        .maybeSingle();
      const retentionDays = settings?.document_retention_days ?? 30;

      const { error: documentError } = await db
        .from("visitor_documents")
        .insert({
          organization_id: organizationId,
          visit_id: created.id,
          visitor_id: visitor.id,
          storage_path: path,
          mime_type: document.type,
          size_bytes: document.size,
          document_type: "manual_capture",
          retention_expires_at: new Date(
            Date.now() + retentionDays * 86400000,
          ).toISOString(),
        });
      if (documentError) {
        // El objeto no debe quedar huérfano si falla el registro de metadatos.
        await db.storage.from("visitor-documents").remove([path]);
        throw documentError;
      }
    }

    await db.from("access_events").insert({
      organization_id: organizationId,
      visit_id: created.id,
      location_id: location.id,
      actor_id: userId,
      event_type: "manual_check_in",
      metadata: { document_captured: hasDocument },
    });
    await writeAudit({
      organizationId,
      actorId: userId,
      visitId: created.id,
      eventType: "manual_check_in",
      metadata: { document_captured: hasDocument },
    });

    const { data: full } = await db
      .from("visits")
      .select(visitSelect)
      .eq("id", created.id)
      .maybeSingle();

    return NextResponse.json(
      { visit: full ? mapVisit(full as unknown as Record<string, unknown>) : null },
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
