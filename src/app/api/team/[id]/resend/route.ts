import { NextResponse } from "next/server";
import { requireApiContext } from "@/lib/server/session";
import { createAdminClient } from "@/lib/server/supabase-admin";
import { issueTeamInvite } from "@/lib/server/team-invite";
import { writeAudit, writeNotification } from "@/lib/server/audit";
import { maskEmail } from "@/lib/security";
import type { MemberRole } from "@/lib/domain";

export const dynamic = "force-dynamic";

export async function POST(
  _request: Request,
  ctx: RouteContext<"/api/team/[id]/resend">,
) {
  const guard = await requireApiContext(["superadmin", "admin"]);
  if (!guard.ok)
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  const { organizationId, organizationName, userId, displayName } =
    guard.context;

  try {
    const { id } = await ctx.params;
    const admin = createAdminClient();
    const { data: member, error } = await admin
      .from("organization_members")
      .select(
        "role,status,profile:profiles!organization_members_profile_id_fkey(full_name,email)",
      )
      .eq("organization_id", organizationId)
      .eq("profile_id", id)
      .maybeSingle();

    if (error || !member)
      return NextResponse.json(
        { error: "Integrante no disponible" },
        { status: 404 },
      );
    if (member.status === "active")
      return NextResponse.json(
        { error: "Esa persona ya completó su alta" },
        { status: 409 },
      );

    const profile = member.profile as unknown as {
      full_name?: string;
      email?: string;
    } | null;
    const email = profile?.email ?? "";
    if (!email)
      return NextResponse.json(
        { error: "Ese integrante no tiene correo" },
        { status: 400 },
      );

    const issued = await issueTeamInvite({
      organizationId,
      organizationName,
      inviterId: userId,
      inviterName: displayName,
      profileId: id,
      email,
      fullName: profile?.full_name ?? email,
      role: member.role as MemberRole,
    });

    await writeNotification({
      organizationId,
      recipientMasked: maskEmail(email),
      template: "team_invite",
      status: issued.delivery.status,
    }).catch(() => undefined);

    await writeAudit({
      organizationId,
      actorId: userId,
      eventType: "member_invite_resent",
      metadata: { profile_id: id, email_status: issued.delivery.status },
    });

    return NextResponse.json({
      delivery: issued.delivery.status,
      inviteUrl: issued.inviteUrl,
    });
  } catch (error) {
    console.error("Team resend failed", error);
    return NextResponse.json(
      { error: "No fue posible reenviar la invitación" },
      { status: 500 },
    );
  }
}
