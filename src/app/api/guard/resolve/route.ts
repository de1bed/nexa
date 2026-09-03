import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiContext } from "@/lib/server/session";
import { rateLimit } from "@/lib/server/rate-limit";
import type { Visit } from "@/lib/domain";

export const dynamic = "force-dynamic";

const schema = z.object({ token: z.string().trim().min(8).max(300) });

type ResolvedRow = {
  visit_id: string;
  organization_id: string;
  location_id: string;
  location_name: string;
  visitor_name: string;
  visitor_company: string;
  visitor_phone: string;
  host_name: string;
  host_email: string;
  purpose: string;
  vehicle_plate: string;
  visitor_notes: string;
  access_requirements: string;
  starts_at: string;
  ends_at: string;
  checked_in_at: string | null;
  visit_status: Visit["status"];
  token_state: string;
  document_captured: boolean;
};

export async function POST(request: Request) {
  const guard = await requireApiContext(["superadmin", "admin", "guard"]);
  if (!guard.ok)
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  const { db, organizationId, userId } = guard.context;

  if (!rateLimit(`scan:${userId}`, 60, 60000).allowed)
    return NextResponse.json(
      { error: "Demasiados intentos seguidos" },
      { status: 429 },
    );

  try {
    const { token } = schema.parse(await request.json());
    const { data, error } = await db
      .rpc("resolve_qr_token", { p_token: token })
      .maybeSingle();

    const row = data as ResolvedRow | null;
    if (error || !row || row.organization_id !== organizationId)
      return NextResponse.json(
        { error: "Este pase no pertenece a tu organización o no existe" },
        { status: 404 },
      );

    const visit: Visit = {
      id: row.visit_id,
      visitorName: row.visitor_name,
      email: "",
      phone: row.visitor_phone || undefined,
      company: row.visitor_company,
      hostId: "",
      hostName: row.host_name,
      hostEmail: row.host_email || undefined,
      locationId: row.location_id,
      location: row.location_name,
      startsAt: row.starts_at,
      endsAt: row.ends_at,
      checkedInAt: row.checked_in_at ?? undefined,
      purpose: row.purpose,
      status: row.visit_status,
      origin: "host_invitation",
      vehiclePlate: row.vehicle_plate || undefined,
      visitorNotes: row.visitor_notes || undefined,
      accessRequirements: row.access_requirements || undefined,
      documentCaptured: row.document_captured,
    };

    return NextResponse.json(
      { visit, tokenState: row.token_state },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (error instanceof z.ZodError)
      return NextResponse.json(
        { error: "El código no tiene un formato válido" },
        { status: 400 },
      );
    console.error("Guard resolve failed", error);
    return NextResponse.json({ error: "Pase no disponible" }, { status: 404 });
  }
}
