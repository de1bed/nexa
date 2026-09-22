import { NextResponse } from "next/server";
import { z } from "zod";
import { createAccessKey } from "@/lib/access-key";
import { getSessionContext } from "@/lib/server/session";
import { isPlatformAdmin } from "@/lib/server/platform-admin";
import { createAdminClient } from "@/lib/server/supabase-admin";
import { issueTeamInvite } from "@/lib/server/team-invite";

export const dynamic = "force-dynamic";

async function guardPlatform() {
  const context = await getSessionContext();
  if (!context.user)
    return { ok: false as const, status: 401, error: "No autenticado" };
  const allowed = await isPlatformAdmin(
    context.user.id,
    context.profile?.email ?? context.user.email ?? "",
  );
  if (!allowed)
    return { ok: false as const, status: 403, error: "Acceso denegado" };
  return { ok: true as const, context };
}

function slugify(value: string) {
  const base = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return base || "org";
}

export async function GET(request: Request) {
  const guard = await guardPlatform();
  if (!guard.ok)
    return NextResponse.json({ error: guard.error }, { status: guard.status });

  const admin = createAdminClient();
  const url = new URL(request.url);
  if (url.searchParams.get("probe") === "1")
    return NextResponse.json({ ok: true });

  const [{ data: orgs }, { data: members }, { data: requests }, { data: areas }] =
    await Promise.all([
      admin
        .from("organizations")
        .select("id,name,slug,access_key,service_status,created_at")
        .order("created_at", { ascending: false }),
      admin
        .from("organization_members")
        .select(
          "organization_id,role,status,profile:profiles!organization_members_profile_id_fkey(full_name,email),department:departments(name)",
        ),
      admin
        .from("access_requests")
        .select("organization_id,status")
        .eq("status", "pending"),
      admin.from("departments").select("id,organization_id,name,active"),
    ]);

  const companies = (orgs ?? []).map((org) => {
    const people = (members ?? []).filter(
      (member) => member.organization_id === org.id,
    );
    return {
      id: org.id as string,
      name: org.name as string,
      slug: org.slug as string,
      accessKey: org.access_key as string,
      serviceStatus: org.service_status as string,
      createdAt: org.created_at as string,
      pendingRequests: (requests ?? []).filter(
        (item) => item.organization_id === org.id,
      ).length,
      departments: (areas ?? [])
        .filter((area) => area.organization_id === org.id && area.active)
        .map((area) => area.name as string),
      members: people.map((member) => {
        const profile = member.profile as unknown as {
          full_name?: string;
          email?: string;
        } | null;
        const department = member.department as unknown as { name?: string } | null;
        return {
          name: profile?.full_name ?? "Persona",
          email: profile?.email ?? "",
          role: member.role as string,
          status: member.status as string,
          department: department?.name ?? "",
        };
      }),
    };
  });

  return NextResponse.json({ companies });
}

const createSchema = z.object({
  name: z.string().trim().min(2).max(120),
  locationName: z.string().trim().min(2).max(120).default("Recepción principal"),
  locationAddress: z.string().trim().min(2).max(300).default("Por definir"),
  adminName: z.string().trim().min(2).max(120),
  adminEmail: z.email(),
});

export async function POST(request: Request) {
  const guard = await guardPlatform();
  if (!guard.ok)
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  const actor = guard.context.user;
  if (!actor)
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  try {
    const input = createSchema.parse(await request.json());
    const admin = createAdminClient();
    let slug = slugify(input.name);
    const { data: taken } = await admin
      .from("organizations")
      .select("slug")
      .like("slug", `${slug}%`);
    const used = new Set((taken ?? []).map((row) => row.slug as string));
    if (used.has(slug)) {
      let suffix = 2;
      while (used.has(`${slug}-${suffix}`)) suffix += 1;
      slug = `${slug}-${suffix}`;
    }

    let accessKey = createAccessKey();
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const { data: clash } = await admin
        .from("organizations")
        .select("id")
        .eq("access_key", accessKey)
        .maybeSingle();
      if (!clash) break;
      accessKey = createAccessKey();
    }

    const { data: org, error } = await admin
      .from("organizations")
      .insert({ name: input.name, slug, access_key: accessKey })
      .select("id,name,access_key")
      .single();
    if (error || !org) throw error ?? new Error("org");

    await admin.from("organization_settings").insert({
      organization_id: org.id,
      privacy_notice:
        "Los datos personales que proporcionas se utilizan únicamente para gestionar, controlar y auditar tu acceso a nuestras instalaciones.",
    });
    await admin.from("locations").insert({
      organization_id: org.id,
      name: input.locationName,
      address: input.locationAddress,
      timezone: "America/Mexico_City",
    });

    const email = input.adminEmail.toLowerCase();
    const { data: existing } = await admin
      .from("profiles")
      .select("id")
      .eq("email", email)
      .maybeSingle();
    let profileId = existing?.id as string | undefined;
    if (!profileId) {
      const created = await admin.auth.admin.createUser({
        email,
        email_confirm: true,
        user_metadata: { full_name: input.adminName },
      });
      profileId = created.data.user?.id;
    }
    if (!profileId) throw new Error("admin");

    await admin.from("profiles").upsert(
      { id: profileId, full_name: input.adminName, email },
      { onConflict: "id" },
    );
    await admin.from("organization_members").upsert(
      {
        organization_id: org.id,
        profile_id: profileId,
        role: "admin",
        status: "invited",
        active: false,
        invited_by: actor.id,
      },
      { onConflict: "organization_id,profile_id" },
    );

    const issued = await issueTeamInvite({
      organizationId: org.id as string,
      organizationName: input.name,
      inviterId: actor.id,
      inviterName: guard.context.profile?.fullName ?? "NEXA",
      profileId,
      email,
      fullName: input.adminName,
      role: "admin",
    });

    return NextResponse.json({
      organizationId: org.id,
      accessKey: org.access_key,
      inviteUrl: issued.inviteUrl,
      delivery: issued.delivery.status,
    });
  } catch {
    return NextResponse.json(
      { error: "No fue posible activar la empresa" },
      { status: 400 },
    );
  }
}

const patchSchema = z.object({
  organizationId: z.uuid(),
  serviceStatus: z.enum(["active", "suspended"]).optional(),
  rotateKey: z.boolean().optional(),
});

export async function PATCH(request: Request) {
  const guard = await guardPlatform();
  if (!guard.ok)
    return NextResponse.json({ error: guard.error }, { status: guard.status });

  try {
    const input = patchSchema.parse(await request.json());
    const admin = createAdminClient();
    const payload: Record<string, string> = {};
    if (input.serviceStatus) payload.service_status = input.serviceStatus;
    if (input.rotateKey) payload.access_key = createAccessKey();
    if (!Object.keys(payload).length)
      return NextResponse.json({ error: "Sin cambios" }, { status: 400 });

    const { data, error } = await admin
      .from("organizations")
      .update(payload)
      .eq("id", input.organizationId)
      .select("id,access_key,service_status")
      .maybeSingle();
    if (error || !data) throw error ?? new Error("missing");
    return NextResponse.json({
      organizationId: data.id,
      accessKey: data.access_key,
      serviceStatus: data.service_status,
    });
  } catch {
    return NextResponse.json({ error: "No fue posible actualizar la empresa" }, { status: 400 });
  }
}
