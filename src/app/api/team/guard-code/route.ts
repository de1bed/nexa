import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { requireApiContext } from "@/lib/server/session";
import { createAdminClient } from "@/lib/server/supabase-admin";
import { writeAudit } from "@/lib/server/audit";
import {
  GUARD_EMAIL_DOMAIN,
  generateGuardCode,
  hashGuardCode,
} from "@/lib/guard-code";
import type { TeamMember } from "@/lib/domain";

export const dynamic = "force-dynamic";

const schema = z.object({
  fullName: z.string().trim().min(2).max(120),
  departmentId: z.uuid().nullable().optional(),
  defaultBoothId: z.uuid().nullable().optional(),
});

export async function POST(request: Request) {
  const guard = await requireApiContext(["superadmin", "admin"]);
  if (!guard.ok)
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  const { organizationId, userId } = guard.context;

  try {
    const input = schema.parse(await request.json());
    const admin = createAdminClient();
    const email = `g.${randomBytes(8).toString("hex")}@${GUARD_EMAIL_DOMAIN}`;
    const accessCode = generateGuardCode();

    let defaultLocationId: string | null = null;
    if (input.defaultBoothId) {
      const { data: booth } = await admin
        .from("booths")
        .select("id, location_id, name")
        .eq("id", input.defaultBoothId)
        .eq("organization_id", organizationId)
        .eq("active", true)
        .maybeSingle();
      if (!booth)
        return NextResponse.json(
          { error: "Esa caseta no está disponible." },
          { status: 400 },
        );
      defaultLocationId = booth.location_id as string;
    }

    const { data: created, error: userError } = await admin.auth.admin.createUser({
      email,
      email_confirm: true,
      password: randomBytes(24).toString("base64url"),
      user_metadata: { full_name: input.fullName },
    });
    if (userError || !created.user)
      return NextResponse.json(
        { error: "No fue posible crear al guardia." },
        { status: 409 },
      );

    const profileId = created.user.id;
    await admin.from("profiles").upsert(
      { id: profileId, full_name: input.fullName, email },
      { onConflict: "id" },
    );

    const { error: memberError } = await admin.from("organization_members").insert({
      organization_id: organizationId,
      profile_id: profileId,
      role: "guard",
      status: "active",
      active: true,
      department_id: input.departmentId ?? null,
      default_booth_id: input.defaultBoothId ?? null,
      default_location_id: defaultLocationId,
      invited_by: userId,
      joined_at: new Date().toISOString(),
    });
    if (memberError) throw memberError;

    const { error: codeError } = await admin.from("guard_access_codes").insert({
      organization_id: organizationId,
      profile_id: profileId,
      code_hash: await hashGuardCode(accessCode),
      code_display: accessCode,
    });
    if (codeError) throw codeError;

    await writeAudit({
      organizationId,
      actorId: userId,
      eventType: "guard_code_created",
      metadata: { name: input.fullName, profile_id: profileId },
    });

    const member: TeamMember = {
      id: profileId,
      name: input.fullName,
      email: "",
      role: "guard",
      active: true,
      status: "active",
      usesAccessCode: true,
      accessCode,
      departmentId: input.departmentId ?? undefined,
      defaultBoothId: input.defaultBoothId ?? undefined,
      defaultLocationId: defaultLocationId ?? undefined,
      joinedAt: new Date().toISOString(),
    };

    return NextResponse.json({ member, accessCode }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError)
      return NextResponse.json({ error: "Revisa el nombre." }, { status: 400 });
    console.error("Guard code create failed", error);
    return NextResponse.json(
      { error: "No fue posible crear al guardia." },
      { status: 500 },
    );
  }
}
