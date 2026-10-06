import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/server/supabase-admin";
import { rateLimit, requestOrigin } from "@/lib/server/rate-limit";
import { logoPublicUrl, verifyWalkin } from "@/lib/server/walkin";

export const dynamic = "force-dynamic";

/**
 * Portada del QR de recepción: solo empresa, sede y logo. Quién trabaja ahí
 * no se muestra hasta que la persona escribe el código impreso.
 */
export async function GET(
  request: Request,
  ctx: RouteContext<"/api/public/walkin/[token]">,
) {
  const limit = rateLimit(`walkin-view:${requestOrigin(request)}`, 30, 60000);
  if (!limit.allowed)
    return NextResponse.json(
      { error: "Demasiados intentos" },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter) } },
    );

  const { token } = await ctx.params;
  const { data } = await createAdminClient()
    .from("walkin_points")
    .select(
      "active,location:locations(name,active),organization:organizations(name,logo_path,service_status,archived_at)",
    )
    .eq("public_token", token)
    .maybeSingle();

  const location = data?.location as unknown as {
    name?: string;
    active?: boolean;
  } | null;
  const organization = data?.organization as unknown as {
    name?: string;
    logo_path?: string | null;
    service_status?: string;
    archived_at?: string | null;
  } | null;

  if (
    !data?.active ||
    !location?.active ||
    organization?.service_status !== "active" ||
    organization.archived_at
  )
    return NextResponse.json(
      { error: "Este QR ya no está disponible" },
      { status: 404 },
    );

  return NextResponse.json(
    {
      organizationName: organization.name ?? "",
      locationName: location.name ?? "",
      logoUrl: logoPublicUrl(organization.logo_path),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

const codeSchema = z.object({ code: z.string().regex(/^\d{4}$/) });

/** Verifica el código y, si es correcto, entrega a quién se puede visitar. */
export async function POST(
  request: Request,
  ctx: RouteContext<"/api/public/walkin/[token]">,
) {
  const limit = rateLimit(`walkin-code:${requestOrigin(request)}`, 20, 600000);
  if (!limit.allowed)
    return NextResponse.json(
      { error: "Demasiados intentos. Espera unos minutos." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter) } },
    );

  try {
    const { token } = await ctx.params;
    const { code } = codeSchema.parse(await request.json());
    const result = await verifyWalkin(token, code, request);

    if (result.state === "invalid")
      return NextResponse.json(
        { error: "Este QR ya no está disponible", state: "invalid" },
        { status: 404 },
      );
    if (result.state === "locked")
      return NextResponse.json(
        {
          error: "Demasiados intentos. Espera unos minutos.",
          state: "locked",
        },
        { status: 429, headers: { "Retry-After": String(result.retryAfter) } },
      );
    if (result.state === "wrong_code")
      return NextResponse.json(
        {
          error: "El código no es correcto",
          state: "wrong_code",
          attemptsLeft: result.attemptsLeft,
        },
        { status: 403 },
      );

    const { data: members } = await createAdminClient()
      .from("organization_members")
      .select(
        "profile_id,profile:profiles!organization_members_profile_id_fkey(full_name),department:departments(name)",
      )
      .eq("organization_id", result.organizationId)
      .eq("active", true)
      .in("role", ["superadmin", "admin", "host"]);

    // Solo nombre y área: ni correo ni teléfono salen hacia el visitante.
    const hosts = (members ?? [])
      .map((row) => ({
        id: row.profile_id as string,
        name:
          (row.profile as unknown as { full_name?: string } | null)?.full_name ??
          "",
        department:
          (row.department as unknown as { name?: string } | null)?.name ?? "",
      }))
      .filter((host) => host.name)
      .sort((a, b) => a.name.localeCompare(b.name, "es"));

    return NextResponse.json(
      { state: "ok", hosts },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (error instanceof z.ZodError)
      return NextResponse.json(
        { error: "El código tiene 4 dígitos" },
        { status: 400 },
      );
    console.error("Walk-in verify failed", error);
    return NextResponse.json(
      { error: "No fue posible validar el código" },
      { status: 500 },
    );
  }
}
