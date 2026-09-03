import { NextResponse } from "next/server";
import { rateLimit, requestOrigin } from "@/lib/server/rate-limit";
import { resolvePassByToken } from "@/lib/server/pass-lookup";
import { googleWalletSaveUrl } from "@/lib/server/wallet/google";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Redirige al flujo «Guardar en Google Wallet» con el pase ya firmado. */
export async function GET(
  request: Request,
  ctx: RouteContext<"/api/public/passes/[token]/google">,
) {
  const limit = rateLimit(`wallet:${requestOrigin(request)}`, 20, 60000);
  if (!limit.allowed)
    return NextResponse.json({ error: "Demasiados intentos" }, { status: 429 });

  try {
    const { token } = await ctx.params;
    const pass = await resolvePassByToken(token);

    if (!pass)
      return NextResponse.json({ error: "Pase no disponible" }, { status: 404 });
    if (pass.state !== "valid")
      return NextResponse.json(
        { error: "Este pase ya no está vigente" },
        { status: 409 },
      );

    const url = googleWalletSaveUrl({ token, ...pass });
    if (!url)
      return NextResponse.json(
        { error: "Google Wallet no está configurado en esta instalación" },
        { status: 501 },
      );

    return NextResponse.redirect(url, { status: 302 });
  } catch (error) {
    console.error("Google Wallet pass failed", error);
    return NextResponse.json(
      { error: "No fue posible generar el pase" },
      { status: 500 },
    );
  }
}
