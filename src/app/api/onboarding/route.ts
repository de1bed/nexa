import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { getSessionContext, ORG_COOKIE } from "@/lib/server/session";
import { onboardingSchema } from "@/lib/schemas";

export const dynamic = "force-dynamic";

/**
 * Alta autónoma de una empresa. Crea organización, membresía de administración,
 * configuración de privacidad y primera ubicación en una sola transacción de
 * PostgreSQL, y deja la organización seleccionada en la sesión.
 */
export async function POST(request: Request) {
  try {
    const input = onboardingSchema.parse(await request.json());
    const context = await getSessionContext();
    if (!context.user)
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const { data, error } = await context.db
      .rpc("create_organization", {
        p_name: input.organizationName,
        p_full_name: input.fullName,
        p_location_name: input.locationName,
        p_location_address: input.locationAddress,
        p_timezone: input.timezone,
      })
      .single();

    if (error || !data) {
      console.error("Onboarding failed", error);
      return NextResponse.json(
        { error: "No fue posible crear la organización" },
        { status: 500 },
      );
    }

    const created = data as unknown as {
      organization_id: string;
      organization_name: string;
      organization_slug: string;
    };

    (await cookies()).set(ORG_COOKIE, created.organization_id, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });

    return NextResponse.json(
      {
        organization: {
          id: created.organization_id,
          name: created.organization_name,
          slug: created.organization_slug,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof z.ZodError)
      return NextResponse.json(
        { error: "Datos inválidos", issues: error.issues },
        { status: 400 },
      );
    console.error("Onboarding failed", error);
    return NextResponse.json(
      { error: "No fue posible crear la organización" },
      { status: 500 },
    );
  }
}
