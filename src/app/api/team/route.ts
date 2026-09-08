import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiContext } from "@/lib/server/session";
import { createAdminClient } from "@/lib/server/supabase-admin";
import { writeAudit, writeNotification } from "@/lib/server/audit";
import { issueTeamInvite } from "@/lib/server/team-invite";
import { teamInviteSchema } from "@/lib/schemas";
import { maskEmail } from "@/lib/security";
import type { MemberRole, MemberStatus } from "@/lib/domain";

export const dynamic = "force-dynamic";

export async function GET() {
  const guard = await requireApiContext(["superadmin", "admin"]);
  if (!guard.ok)
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  const { db, organizationId } = guard.context;

  const { data, error } = await db
    .from("organization_members")
    .select(
      "profile_id,role,active,status,created_at,joined_at,invite_delivery,profile:profiles!organization_members_profile_id_fkey(full_name,email)",
    )
    .eq("organization_id", organizationId)
    .order("created_at");

  if (error)
    return NextResponse.json(
      { error: "No fue posible cargar el equipo" },
      { status: 500 },
    );

  return NextResponse.json(
    {
      members: (data ?? []).map((row) => {
        const profile = row.profile as unknown as {
          full_name?: string;
          email?: string;
        } | null;
        const status = (row.status as MemberStatus) ?? (row.active ? "active" : "suspended");
        return {
          id: row.profile_id as string,
          role: row.role as MemberRole,
          active: row.active as boolean,
          status,
          name: profile?.full_name ?? "Usuario",
          email: profile?.email ?? "",
          joinedAt: (row.joined_at as string | null) ?? undefined,
          invitedAt: row.created_at as string,
          inviteDelivery: row.invite_delivery as
            | "sent"
            | "failed"
            | "development"
            | undefined,
        };
      }),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(request: Request) {
  const guard = await requireApiContext(["superadmin", "admin"]);
  if (!guard.ok)
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  const { organizationId, organizationName, userId, displayName } =
    guard.context;

  try {
    const input = teamInviteSchema.parse(await request.json());
    const admin = createAdminClient();
    const email = input.email.toLowerCase();

    const { data: existing } = await admin
      .from("profiles")
      .select("id,full_name")
      .eq("email", email)
      .maybeSingle();

    let profileId = existing?.id as string | undefined;

    if (profileId) {
      const { data: membership } = await admin
        .from("organization_members")
        .select("status,active")
        .eq("organization_id", organizationId)
        .eq("profile_id", profileId)
        .maybeSingle();
      if (membership?.status === "active")
        return NextResponse.json(
          { error: "Esa persona ya es miembro de la organización" },
          { status: 409 },
        );
    }

    if (!profileId) {
      const { data, error } = await admin.auth.admin.createUser({
        email,
        email_confirm: false,
        user_metadata: { full_name: input.fullName },
      });
      if (error || !data.user) {
        const alreadyRegistered = /already|exists|registered/i.test(
          error?.message ?? "",
        );
        if (!alreadyRegistered)
          return NextResponse.json(
            { error: "No fue posible crear la cuenta de esa persona" },
            { status: 409 },
          );
        const { data: byEmail } = await admin
          .from("profiles")
          .select("id")
          .eq("email", email)
          .maybeSingle();
        profileId = byEmail?.id as string | undefined;
      } else {
        profileId = data.user.id;
      }
    }

    if (!profileId)
      return NextResponse.json(
        { error: "No fue posible crear la cuenta de esa persona" },
        { status: 409 },
      );

    await admin
      .from("profiles")
      .upsert(
        { id: profileId, full_name: input.fullName, email },
        { onConflict: "id" },
      );

    const { error: memberError } = await admin
      .from("organization_members")
      .upsert(
        {
          organization_id: organizationId,
          profile_id: profileId,
          role: input.role,
          status: "invited",
          active: false,
          invited_by: userId,
        },
        { onConflict: "organization_id,profile_id" },
      );
    if (memberError) throw memberError;

    const issued = await issueTeamInvite({
      organizationId,
      organizationName,
      inviterId: userId,
      inviterName: displayName,
      profileId,
      email,
      fullName: input.fullName,
      role: input.role,
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
      eventType: "member_invited",
      metadata: {
        role: input.role,
        email_status: issued.delivery.status,
      },
    });

    return NextResponse.json(
      {
        member: {
          id: profileId,
          name: input.fullName,
          email,
          role: input.role,
          active: false,
          status: "invited",
          invitedAt: new Date().toISOString(),
          inviteDelivery: issued.delivery.status,
        },
        delivery: issued.delivery.status,
        inviteUrl: issued.inviteUrl,
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof z.ZodError)
      return NextResponse.json(
        { error: "Datos inválidos", issues: error.issues },
        { status: 400 },
      );
    console.error("Team POST failed", error);
    return NextResponse.json(
      { error: "No fue posible invitar al usuario" },
      { status: 500 },
    );
  }
}
