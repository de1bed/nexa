import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/server/supabase-admin";
import { rateLimit, requestOrigin } from "@/lib/server/rate-limit";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  ctx: RouteContext<"/api/public/invitations/[token]">,
) {
  const limit = rateLimit(`invite:${requestOrigin(request)}`, 30, 60000);
  if (!limit.allowed)
    return NextResponse.json(
      { error: "Demasiados intentos" },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter) } },
    );

  try {
    const { token } = await ctx.params;
    const db = createAdminClient();
    const { data, error } = await db
      .rpc("resolve_invitation", { p_token: token })
      .maybeSingle();

    if (error || !data)
      return NextResponse.json(
        { error: "Enlace no disponible" },
        { status: 404 },
      );

    // Lo que la empresa le pide en esta visita. Solo lo necesario para el formulario.
    const { data: requested } = await db
      .from("visit_attachments")
      .select("id,title,description,ask_photo,ask_text,required")
      .eq("visit_id", (data as { visit_id: string }).visit_id)
      .eq("source", "requested")
      .order("sort_order");

    return NextResponse.json(
      {
        ...(data as Record<string, unknown>),
        requested_attachments: (requested ?? []).map((item) => ({
          id: item.id,
          title: item.title,
          description: item.description,
          askPhoto: item.ask_photo,
          askText: item.ask_text,
          required: item.required,
        })),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("Public invitation failed", error);
    return NextResponse.json(
      { error: "Enlace no disponible" },
      { status: 404 },
    );
  }
}
