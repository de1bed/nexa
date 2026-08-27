import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { getSessionContext } from "@/lib/server/session";

export async function GET() {
  try {
    const context = await getSessionContext();
    if (!context.user)
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    return NextResponse.json({
      memberships: context.memberships,
      selected: context.selected,
    });
  } catch {
    return NextResponse.json(
      { error: "Sesión no disponible" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const { organizationId } = z
      .object({ organizationId: z.uuid() })
      .parse(await request.json());
    const context = await getSessionContext();
    if (
      !context.user ||
      !context.memberships.some(
        (membership) => membership.organizationId === organizationId,
      )
    )
      return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });
    (await cookies()).set("nexa-org", organizationId, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError)
      return NextResponse.json(
        { error: "Organización inválida" },
        { status: 400 },
      );
    return NextResponse.json(
      { error: "No fue posible seleccionar" },
      { status: 500 },
    );
  }
}
