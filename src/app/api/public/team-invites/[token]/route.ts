import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/server/supabase-admin";
import { rateLimit, requestOrigin } from "@/lib/server/rate-limit";
import { teamAcceptSchema } from "@/lib/schemas";
import { sha256 } from "@/lib/security";
import { writeAudit } from "@/lib/server/audit";
import type { MemberRole } from "@/lib/domain";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  ctx: RouteContext<"/api/public/team-invites/[token]">,
) {
  const limit = rateLimit(`team-invite:${requestOrigin(request)}`, 30, 60000);
  if (!limit.allowed)
    return NextResponse.json(
      { error: "Demasiados intentos" },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter) } },
    );

  try {
    const { token } = await ctx.params;
    const { data, error } = await createAdminClient()
      .rpc("resolve_team_invite", { p_token: token })
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
    console.error("Team invite lookup failed", error);
    return NextResponse.json(
      { error: "Enlace no disponible" },
      { status: 404 },
    );
  }
}

export async function POST(
  request: Request,
  ctx: RouteContext<"/api/public/team-invites/[token]">,
) {
  const limit = rateLimit(`team-accept:${requestOrigin(request)}`, 12, 60000);
  if (!limit.allowed)
    return NextResponse.json(
      { error: "Demasiados intentos" },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter) } },
    );

  try {
    const { token } = await ctx.params;
    const input = teamAcceptSchema.parse(await request.json());
    const admin = createAdminClient();
    const tokenHash = await sha256(token);

    const { data: invite, error } = await admin
      .from("team_invitations")
      .select(
        "id,organization_id,profile_id,email,role,expires_at,accepted_at,revoked_at",
      )
      .eq("token_hash", tokenHash)
      .maybeSingle();

    if (error || !invite)
      return NextResponse.json(
        { error: "Enlace no disponible" },
        { status: 404 },
      );
    if (invite.revoked_at)
      return NextResponse.json(
        { error: "Esta invitación ya no está vigente" },
        { status: 410 },
      );
    if (invite.accepted_at)
      return NextResponse.json(
        { error: "Esta invitación ya se usó. Entra con tu correo y contraseña." },
        { status: 409 },
      );
    if (new Date(invite.expires_at as string).getTime() < Date.now())
      return NextResponse.json(
        { error: "El enlace venció. Pide una nueva invitación." },
        { status: 410 },
      );

    const { error: authError } = await admin.auth.admin.updateUserById(
      invite.profile_id as string,
      { password: input.password, email_confirm: true },
    );
    if (authError) {
      console.error("Team invite password failed", authError);
      return NextResponse.json(
        { error: "No fue posible guardar la contraseña" },
        { status: 500 },
      );
    }

    const now = new Date().toISOString();
    const { error: memberError } = await admin
      .from("organization_members")
      .update({
        status: "active",
        active: true,
        role: invite.role,
        joined_at: now,
      })
      .eq("organization_id", invite.organization_id)
      .eq("profile_id", invite.profile_id);
    if (memberError) throw memberError;

    await admin
      .from("team_invitations")
      .update({ accepted_at: now })
      .eq("id", invite.id);

    await admin
      .from("team_invitations")
      .update({ revoked_at: now })
      .eq("organization_id", invite.organization_id)
      .eq("profile_id", invite.profile_id)
      .is("accepted_at", null)
      .is("revoked_at", null)
      .neq("id", invite.id);

    await writeAudit({
      organizationId: invite.organization_id as string,
      actorId: invite.profile_id as string,
      eventType: "member_joined",
      metadata: { role: invite.role },
    });

    return NextResponse.json({
      email: invite.email,
      role: invite.role as MemberRole,
    });
  } catch (error) {
    if (error instanceof z.ZodError)
      return NextResponse.json(
        { error: error.issues[0]?.message ?? "Datos inválidos" },
        { status: 400 },
      );
    console.error("Team invite accept failed", error);
    return NextResponse.json(
      { error: "No fue posible crear la cuenta" },
      { status: 500 },
    );
  }
}
