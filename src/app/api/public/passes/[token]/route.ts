import { NextResponse } from "next/server";
import { rateLimit, requestOrigin } from "@/lib/server/rate-limit";
import { resolvePassByToken } from "@/lib/server/pass-lookup";
import { walletAvailability } from "@/lib/server/wallet/config";

export const dynamic = "force-dynamic";

/**
 * Vista pública del pase. Devuelve lo mínimo para que el visitante reconozca su
 * visita; el token nunca viaja de vuelta y no se expone información de contacto.
 */
export async function GET(
  request: Request,
  ctx: RouteContext<"/api/public/passes/[token]">,
) {
  const limit = rateLimit(`pass:${requestOrigin(request)}`, 40, 60000);
  if (!limit.allowed)
    return NextResponse.json(
      { error: "Demasiados intentos" },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter) } },
    );

  try {
    const { token } = await ctx.params;
    const pass = await resolvePassByToken(token);

    if (!pass)
      return NextResponse.json(
        { error: "Pase no disponible" },
        { status: 404 },
      );

    return NextResponse.json(
      { ...pass, wallet: walletAvailability() },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("Public pass failed", error);
    return NextResponse.json({ error: "Pase no disponible" }, { status: 404 });
  }
}
