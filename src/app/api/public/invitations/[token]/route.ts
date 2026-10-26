import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/server/supabase-admin";
import { invitationTimezoneSelect } from "@/lib/location-embed";
import { rateLimit, requestOrigin } from "@/lib/server/rate-limit";
import { resolveTimeZone } from "@/lib/timezone";

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
    const visitId = (data as { visit_id: string }).visit_id;
    const { data: requested } = await db
      .from("visit_attachments")
      .select("id,title,description,ask_photo,ask_text,required")
      .eq("visit_id", visitId)
      .eq("source", "requested")
      .order("sort_order");

    const { data: site } = await db
      .from("visits")
      .select(invitationTimezoneSelect)
      .eq("id", visitId)
      .maybeSingle();
    const location = site?.location as
      | { timezone?: string }
      | { timezone?: string }[]
      | null
      | undefined;
    const locationTimezone = Array.isArray(location)
      ? location[0]?.timezone
      : location?.timezone;

    return NextResponse.json(
      {
        ...(data as Record<string, unknown>),
        location_timezone: resolveTimeZone(locationTimezone),
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
