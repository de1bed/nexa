import { NextResponse } from "next/server";
import { rateLimit, requestOrigin } from "@/lib/server/rate-limit";
import { resolvePassByToken } from "@/lib/server/pass-lookup";
import { buildApplePass } from "@/lib/server/wallet/apple";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Entrega el archivo .pkpass para añadir la visita a Apple Wallet. */
export async function GET(
  request: Request,
  ctx: RouteContext<"/api/public/passes/[token]/apple">,
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

    const file = await buildApplePass({ token, ...pass });
    if (!file)
      return NextResponse.json(
        { error: "Apple Wallet no está configurado en esta instalación" },
        { status: 501 },
      );

    return new NextResponse(new Uint8Array(file), {
      headers: {
        "Content-Type": "application/vnd.apple.pkpass",
        "Content-Disposition": 'attachment; filename="nexa-visit.pkpass"',
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Apple Wallet pass failed", error);
    return NextResponse.json(
      { error: "No fue posible generar el pase" },
      { status: 500 },
    );
  }
}
