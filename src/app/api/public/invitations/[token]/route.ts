import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/server/supabase-admin";
import { rateLimit } from "@/lib/server/rate-limit";
export async function GET(
  request: Request,
  ctx: RouteContext<"/api/public/invitations/[token]">,
) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0] ?? "local";
  const limit = rateLimit(`invite:${ip}`);
  if (!limit.allowed)
    return NextResponse.json(
      { error: "Demasiados intentos" },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter) } },
    );
  try {
    const { token } = await ctx.params;
    const { data, error } = await createAdminClient()
      .rpc("resolve_invitation", { p_token: token })
      .single();
    if (error || !data)
      return NextResponse.json(
        { error: "Enlace no disponible" },
        { status: 404 },
      );
    return NextResponse.json(data, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return NextResponse.json(
      { error: "Enlace no disponible" },
      { status: 404 },
    );
  }
}
