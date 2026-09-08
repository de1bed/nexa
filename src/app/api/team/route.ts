import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiContext } from "@/lib/server/session";
import { createAdminClient } from "@/lib/server/supabase-admin";
import {
  sendTeamInviteEmail,
  type DeliveryResult,
} from "@/lib/server/email";
import { writeAudit, writeNotification } from "@/lib/server/audit";
import { teamInviteSchema } from "@/lib/schemas";
import { appUrl } from "@/lib/config";
import { maskEmail } from "@/lib/security";
import { roleLabels, type MemberRole } from "@/lib/domain";

export const dynamic = "force-dynamic";

async function issueMagicLinkOtp(
  admin: ReturnType<typeof createAdminClient>,
  email: string,
) {
  const { data, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  if (error || !data) {
    console.error("Team invite generateLink failed", error);
    return {};
  }
  return {
    otp: data.properties?.email_otp,
    userId: data.user?.id,
  };
}

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
          joinedAt: row.created_at as string,
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

    // Un correo que ya existe se suma a esta organización en vez de fallar:
    // la misma persona puede trabajar en varias empresas.
    const { data: existing } = await admin
      .from("profiles")
      .select("id,full_name")
      .eq("email", email)
      .maybeSingle();

    let profileId = existing?.id as string | undefined;
    const createdAccount = !profileId;
    let emailOtp: string | undefined;

    if (!profileId) {
      // Cuenta sin contraseña: el código va en el correo de la aplicación
      // (Resend), no en la plantilla de invitación de Supabase Auth.
      const { data, error } = await admin.auth.admin.createUser({
        email,
        email_confirm: true,
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
      } else {
        profileId = data.user.id;
      }
    }

    if (createdAccount) {
      const issued = await issueMagicLinkOtp(admin, email);
      emailOtp = issued.otp;
      profileId ??= issued.userId;
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
          active: true,
        },
        { onConflict: "organization_id,profile_id" },
      );
    if (memberError) throw memberError;

    const loginUrl = `${appUrl()}/login?email=${encodeURIComponent(email)}${
      emailOtp ? "&welcome=1" : ""
    }`;

    let delivery: DeliveryResult;
    try {
      delivery = await sendTeamInviteEmail({
        to: email,
        fullName: input.fullName,
        organizationName,
        roleLabel: roleLabels[input.role],
        actionUrl: loginUrl,
        otp: emailOtp,
        existingAccount: !createdAccount,
      });
    } catch (reason) {
      console.error("Team invite email failed", reason);
      delivery = { status: "failed" };
    }

    await writeNotification({
      organizationId,
      recipientMasked: maskEmail(email),
      template: "team_invite",
      status: delivery.status,
    }).catch(() => undefined);

    await writeAudit({
      organizationId,
      actorId: userId,
      eventType: "member_invited",
      metadata: {
        role: input.role,
        existing_account: !createdAccount,
        email_status: delivery.status,
      },
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
        delivery: delivery.status,
        loginUrl,
        createdAccount,
        // Si el correo no salió, el admin puede compartir el código a mano.
        otp: delivery.status === "sent" ? undefined : emailOtp,
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
