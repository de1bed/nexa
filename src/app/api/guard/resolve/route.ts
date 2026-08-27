import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionContext } from "@/lib/server/session";
import { rateLimit } from "@/lib/server/rate-limit";
export async function POST(request: Request) {
  const context = await getSessionContext();
  if (!context.user)
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  if (
    !context.selected ||
    !["guard", "admin", "superadmin"].includes(context.selected.role)
  )
    return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });
  if (!rateLimit(`scan:${context.user.id}`, 30, 60000).allowed)
    return NextResponse.json({ error: "Demasiados intentos" }, { status: 429 });
  try {
    const { token } = z
      .object({ token: z.string().min(20).max(200) })
      .parse(await request.json());
    const { data, error } = await context.db
      .rpc("resolve_qr_token", { p_token: token })
      .single();
    const row = data as null | {
      visit_id: string;
      organization_id: string;
      location_id: string;
      visitor_name: string;
      visitor_company: string;
      host_name: string;
      purpose: string;
      starts_at: string;
      ends_at: string;
      visit_status: string;
      token_state: string;
      document_captured: boolean;
    };
    if (
      error ||
      !row ||
      row.organization_id !== context.selected.organizationId
    )
      return NextResponse.json(
        { error: "Pase no disponible" },
        { status: 404 },
      );
    return NextResponse.json({
      visit: {
        id: row.visit_id,
        visitorName: row.visitor_name,
        email: "",
        company: row.visitor_company,
        hostName: row.host_name,
        hostId: "",
        location: "Recepción",
        startsAt: row.starts_at,
        endsAt: row.ends_at,
        purpose: row.purpose,
        status: row.visit_status,
        origin: "host_invitation",
        documentCaptured: row.document_captured,
      },
      tokenState: row.token_state,
    });
  } catch (error) {
    if (error instanceof z.ZodError)
      return NextResponse.json({ error: "Código inválido" }, { status: 400 });
    return NextResponse.json({ error: "Pase no disponible" }, { status: 404 });
  }
}
