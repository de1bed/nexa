import { NextResponse } from "next/server";
import { requireApiContext } from "@/lib/server/session";
import { createAdminClient } from "@/lib/server/supabase-admin";
import { writeAudit } from "@/lib/server/audit";
import { generateGuardCode, hashGuardCode } from "@/lib/guard-code";

export const dynamic = "force-dynamic";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireApiContext(["superadmin", "admin"]);
  if (!guard.ok)
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  const { organizationId, userId } = guard.context;

  try {
    const { id: profileId } = await params;
    const admin = createAdminClient();

    const { data: membership } = await admin
      .from("organization_members")
      .select("role, active, profile_id")
      .eq("organization_id", organizationId)
      .eq("profile_id", profileId)
      .eq("role", "guard")
      .maybeSingle();

    if (!membership || !membership.active)
      return NextResponse.json(
        { error: "Ese guardia no existe o no está activo." },
        { status: 404 },
      );

    const { data: existingCode } = await admin
      .from("guard_access_codes")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("profile_id", profileId)
      .eq("active", true)
      .maybeSingle();

    if (existingCode) {
      await admin
        .from("guard_access_codes")
        .update({ active: false })
        .eq("id", existingCode.id);
    }

    const accessCode = generateGuardCode();
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
      eventType: "guard_code_regenerated",
      metadata: { profile_id: profileId },
    });

    return NextResponse.json({ accessCode });
  } catch (error) {
    console.error("Guard code regenerate failed", error);
    return NextResponse.json(
      { error: "No fue posible regenerar el código." },
      { status: 500 },
    );
  }
}
