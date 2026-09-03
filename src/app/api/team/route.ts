import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiContext } from "@/lib/server/session";
import { createAdminClient } from "@/lib/server/supabase-admin";
import { sendTeamInviteEmail } from "@/lib/server/email";
import { writeAudit } from "@/lib/server/audit";
import { teamInviteSchema } from "@/lib/schemas";
import { appUrl } from "@/lib/config";
import { roleLabels, type MemberRole } from "@/lib/domain";

export const dynamic = "force-dynamic";

export async function GET() {
  const guard = await requireApiContext(["superadmin", "admin"]);
  if (!guard.ok)
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  const { db, organizationId } = guard.context;

  const { data, error } = await db
    .from("organization_members")
    .select(
      "profile_id,role,active,created_at,profile:profiles!organization_members_profile_id_fkey(full_name,email)",
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
        return {
          id: row.profile_id as string,
          role: row.role as MemberRole,
          active: row.active as boolean,
          name: profile?.full_name ?? "Usuario",
          email: profile?.email ?? "",
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
  const { organizationId, organizationName, userId } = guard.context;

  try {
    const input = teamInviteSchema.parse(await request.json());
    const admin = createAdminClient();
    const email = input.email.toLowerCase();
    const redirectTo = `${appUrl()}/auth/callback?next=/update-password`;

    // Un correo que ya existe se suma a esta organización en vez de fallar:
    // la misma persona puede trabajar en varias empresas.
    const { data: existing } = await admin
      .from("profiles")
      .select("id,full_name")
      .eq("email", email)
      .maybeSingle();

    let profileId = existing?.id as string | undefined;
    let invited = false;

    if (!profileId) {
      const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
        data: { full_name: input.fullName },
        redirectTo,
      });
      if (error || !data.user)
        return NextResponse.json(
          { error: "No fue posible enviar la invitación a ese correo" },
          { status: 409 },
        );
      profileId = data.user.id;
      invited = true;
    }

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
          active: true,
        },
        { onConflict: "organization_id,profile_id" },
      );
    if (memberError) throw memberError;

    if (!invited)
      await sendTeamInviteEmail({
        to: email,
        fullName: input.fullName,
        organizationName,
        roleLabel: roleLabels[input.role],
        actionUrl: `${appUrl()}/login`,
      }).catch(() => undefined);

    await writeAudit({
      organizationId,
      actorId: userId,
      eventType: "member_invited",
      metadata: { role: input.role, existing_account: !invited },
    });

    return NextResponse.json(
      {
        member: {
          id: profileId,
          name: input.fullName,
          email,
          role: input.role,
          active: true,
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
    console.error("Team POST failed", error);
    return NextResponse.json(
      { error: "No fue posible invitar al usuario" },
      { status: 500 },
    );
  }
}
