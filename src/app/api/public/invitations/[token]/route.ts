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
    const { data, error } = await createAdminClient()
      .rpc("resolve_invitation", { p_token: token })
      .maybeSingle();

    if (error || !data)
      return NextResponse.json(
        { error: "Enlace no disponible" },
        { status: 404 },
      );

    return NextResponse.json(data, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("Public invitation failed", error);
    return NextResponse.json(
      { error: "Enlace no disponible" },
      { status: 404 },
    );
  }
}
