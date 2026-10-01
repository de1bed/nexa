import { NextResponse } from "next/server";
import { z } from "zod";
import { createAccessKey } from "@/lib/access-key";
import { getSessionContext } from "@/lib/server/session";
import { isPlatformAdmin, platformAdminEmails } from "@/lib/server/platform-admin";
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

async function logPlatformEvent(input: {
  organizationId: string;
  actorId: string;
  eventType:
    | "company_created"
    | "service_paused"
    | "service_resumed"
    | "key_rotated"
    | "payment_recorded"
    | "company_updated"
    | "company_archived"
    | "company_restored"
    | "admin_invite_resent"
    | "company_deleted";
  summary: string;
}) {
  const admin = createAdminClient();
  const { error } = await admin.from("platform_events").insert({
    organization_id: input.organizationId,
    actor_id: input.actorId,
    event_type: input.eventType,
    summary: input.summary,
  });
  if (error) throw error;
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

  const [
    { data: orgs },
    { data: members },
    { data: requests },
    { data: areas },
    { data: sites },
    { data: visits },
    { data: visitRows },
    { data: accounts },
    { data: payments },
    { data: events },
  ] = await Promise.all([
    admin
      .from("organizations")
      .select("id,name,slug,access_key,service_status,archived_at,created_at")
      .order("created_at", { ascending: false }),
    admin
      .from("organization_members")
      .select(
        "profile_id,organization_id,role,status,joined_at,profile:profiles!organization_members_profile_id_fkey(full_name,email),department:departments(name)",
      ),
    admin
      .from("access_requests")
      .select(
        "id,organization_id,requested_role,status,created_at,profile:profiles!access_requests_profile_id_fkey(full_name,email)",
      )
      .eq("status", "pending")
      .order("created_at", { ascending: true }),
    admin.from("departments").select("id,organization_id,name,active"),
    admin.from("locations").select("id,organization_id,name,address,active"),
    admin.rpc("platform_visit_counts"),
    admin
      .from("visits")
      .select(
        "id,organization_id,purpose,status,starts_at,visitor:visitors(full_name),host:profiles!visits_host_id_fkey(full_name)",
      )
      .order("starts_at", { ascending: false })
      .limit(200),
    admin
      .from("platform_accounts")
      .select("organization_id,plan_name,monthly_amount,currency,billing_email,notes"),
    admin
      .from("platform_payments")
      .select("id,organization_id,amount,currency,paid_on,method,reference,concept,created_at")
      .order("paid_on", { ascending: false }),
    admin
      .from("platform_events")
      .select(
        "id,organization_id,event_type,summary,created_at,actor:profiles!platform_events_actor_id_fkey(full_name)",
      )
      .order("created_at", { ascending: false })
      .limit(40),
  ]);

  const companies = (orgs ?? []).map((org) => {
    const people = (members ?? []).filter(
      (member) => member.organization_id === org.id,
    );
    const orgVisits = (
      (visits ?? []) as Array<{
        organization_id: string;
        visits: number;
        visits_this_month: number;
        visits_today: number;
        last_visit: string | null;
      }>
    ).find((visit) => visit.organization_id === org.id);
    const orgPayments = (payments ?? []).filter(
      (payment) => payment.organization_id === org.id,
    );
    const account = (accounts ?? []).find((item) => item.organization_id === org.id);
    return {
      id: org.id as string,
      name: org.name as string,
      slug: org.slug as string,
      accessKey: org.access_key as string,
      serviceStatus: org.service_status as string,
      archivedAt: (org.archived_at as string | null) ?? null,
      createdAt: org.created_at as string,
      pendingRequests: (requests ?? []).filter(
        (item) => item.organization_id === org.id && item.status === "pending",
      ).length,
      departments: (areas ?? [])
        .filter((area) => area.organization_id === org.id && area.active)
        .map((area) => area.name as string),
      locations: (sites ?? [])
        .filter((site) => site.organization_id === org.id && site.active)
        .map((site) => ({
          id: site.id as string,
          name: site.name as string,
          address: site.address as string,
        })),
      visits: Number(orgVisits?.visits ?? 0),
      visitsThisMonth: Number(orgVisits?.visits_this_month ?? 0),
      visitsToday: Number(orgVisits?.visits_today ?? 0),
      lastVisitAt: (orgVisits?.last_visit as string | null) ?? null,
      recentVisits: (visitRows ?? [])
        .filter((visit) => visit.organization_id === org.id)
        .slice(0, 12)
        .map((visit) => {
          const visitor = visit.visitor as unknown as { full_name?: string } | null;
          const host = visit.host as unknown as { full_name?: string } | null;
          return {
            id: visit.id as string,
            visitor: visitor?.full_name ?? "Visitante",
            host: host?.full_name ?? "",
            purpose: (visit.purpose as string) ?? "",
            status: visit.status as string,
            startsAt: visit.starts_at as string,
          };
        }),
      invitePending: people.some(
        (member) =>
          member.status === "invited" &&
          (member.role === "admin" || member.role === "superadmin"),
      ),
      planName: (account?.plan_name as string | undefined) ?? "",
      monthlyAmount:
        account?.monthly_amount == null ? null : Number(account.monthly_amount),
      currency: (account?.currency as string | undefined) ?? "MXN",
      billingEmail: (account?.billing_email as string | null) ?? "",
      notes: (account?.notes as string | undefined) ?? "",
      payments: orgPayments.map((payment) => ({
        id: payment.id as string,
        amount: Number(payment.amount),
        currency: payment.currency as string,
        paidOn: payment.paid_on as string,
        method: payment.method as string,
        reference: payment.reference as string,
        concept: payment.concept as string,
      })),
      members: people.map((member) => {
        const profile = member.profile as unknown as {
          full_name?: string;
          email?: string;
        } | null;
        const department = member.department as unknown as { name?: string } | null;
        return {
          id: member.profile_id as string,
          name: profile?.full_name ?? "Persona",
          email: profile?.email ?? "",
          role: member.role as string,
          status: member.status as string,
          department: department?.name ?? "",
          joinedAt: (member.joined_at as string | null) ?? null,
        };
      }),
    };
  });

  const orgName = new Map(
    (orgs ?? []).map((org) => [org.id as string, org.name as string]),
  );

  return NextResponse.json({
    companies,
    requests: (requests ?? []).map((row) => {
      const profile = row.profile as unknown as {
        full_name?: string;
        email?: string;
      } | null;
      return {
        id: row.id as string,
        organizationId: row.organization_id as string,
        organizationName: orgName.get(row.organization_id as string) ?? "Empresa",
        name: profile?.full_name ?? "Persona",
        email: profile?.email ?? "",
        role: row.requested_role as string,
        createdAt: row.created_at as string,
      };
    }),
    events: (events ?? []).map((row) => {
      const actor = row.actor as unknown as { full_name?: string } | null;
      return {
        id: row.id as string,
        organizationId: (row.organization_id as string | null) ?? "",
        organizationName: orgName.get(row.organization_id as string) ?? "Empresa",
        actorName: actor?.full_name ?? "NEXA",
        type: row.event_type as string,
        summary: row.summary as string,
        createdAt: row.created_at as string,
      };
    }),
  });
}

const locationInput = z.object({
  name: z.string().trim().min(2).max(120),
  address: z.string().trim().min(2).max(300),
});

const createSchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    locations: z.array(locationInput).min(1).max(20),
    adminName: z.string().trim().min(2).max(120),
    adminEmail: z.email(),
  })
  .superRefine((value, ctx) => {
    const seen = new Set<string>();
    value.locations.forEach((site, index) => {
      const key = site.name.toLocaleLowerCase("es");
      if (seen.has(key)) {
        ctx.addIssue({
          code: "custom",
          message: "Hay dos sedes con el mismo nombre",
          path: ["locations", index, "name"],
        });
      }
      seen.add(key);
    });
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
    const { error: locationError } = await admin.from("locations").insert(
      input.locations.map((site) => ({
        organization_id: org.id,
        name: site.name,
        address: site.address,
        timezone: "America/Mexico_City",
      })),
    );
    if (locationError) {
      await admin.from("organizations").delete().eq("id", org.id);
      const code = "code" in locationError ? String(locationError.code) : "";
      if (code === "23505")
        return NextResponse.json(
          { error: "Hay dos sedes con el mismo nombre" },
          { status: 400 },
        );
      throw locationError;
    }

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

    await logPlatformEvent({
      organizationId: org.id as string,
      actorId: actor.id,
      eventType: "company_created",
      summary: `Activó ${input.name} con ${input.locations.length} ${input.locations.length === 1 ? "sede" : "sedes"} e invitó a ${input.adminName}`,
    });

    return NextResponse.json({
      organizationId: org.id,
      accessKey: org.access_key,
      inviteUrl: issued.inviteUrl,
      delivery: issued.delivery.status,
    });
  } catch (error) {
    const message =
      error instanceof z.ZodError
        ? (error.issues[0]?.message ?? "Revisa las sedes y los datos de la empresa")
        : "No fue posible activar la empresa";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

const patchSchema = z.object({
  organizationId: z.uuid(),
  serviceStatus: z.enum(["active", "suspended"]).optional(),
  rotateKey: z.boolean().optional(),
  resendAdmin: z.boolean().optional(),
  planName: z.string().trim().max(80).optional(),
  monthlyAmount: z.number().min(0).max(100000000).nullable().optional(),
  currency: z.enum(["MXN", "USD"]).optional(),
  billingEmail: z.union([z.email(), z.literal("")]).optional(),
  notes: z.string().max(2000).optional(),
  name: z.string().trim().min(2).max(120).optional(),
  locations: z
    .array(
      z.object({
        id: z.uuid(),
        name: z.string().trim().min(2).max(120),
        address: z.string().trim().min(2).max(300),
      }),
    )
    .max(20)
    .optional(),
  archive: z.boolean().optional(),
  restore: z.boolean().optional(),
  removeCompany: z.boolean().optional(),
  confirmName: z.string().trim().min(2).max(120).optional(),
  newLocation: z
    .object({
      name: z.string().trim().min(2).max(120),
      address: z.string().trim().min(2).max(300),
    })
    .optional(),
  inviteMember: z
    .object({
      name: z.string().trim().min(2).max(120),
      email: z.email(),
      role: z.enum(["admin", "host", "guard"]),
    })
    .optional(),
  removeMemberId: z.uuid().optional(),
  dismissRequestId: z.uuid().optional(),
  payment: z
    .object({
      amount: z.number().positive().max(100000000),
      currency: z.enum(["MXN", "USD"]),
      paidOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      method: z.enum(["transfer", "cash", "card", "other"]),
      reference: z.string().trim().max(80).optional(),
      concept: z.string().trim().max(200).optional(),
    })
    .optional(),
});

async function eraseCompany(
  admin: ReturnType<typeof createAdminClient>,
  organizationId: string,
) {
  const { data: documents, error: documentsError } = await admin
    .from("visitor_documents")
    .select("storage_path")
    .eq("organization_id", organizationId);
  if (documentsError) throw documentsError;

  const paths = (documents ?? [])
    .map((row) => row.storage_path as string)
    .filter(Boolean);
  for (let index = 0; index < paths.length; index += 100) {
    const { error } = await admin.storage
      .from("visitor-documents")
      .remove(paths.slice(index, index + 100));
    if (error) throw error;
  }

  const { error: eventsError } = await admin
    .from("access_events")
    .delete()
    .eq("organization_id", organizationId);
  if (eventsError) throw eventsError;

  const { error: visitsError } = await admin
    .from("visits")
    .delete()
    .eq("organization_id", organizationId);
  if (visitsError) throw visitsError;

  const { data: removed, error } = await admin
    .from("organizations")
    .delete()
    .eq("id", organizationId)
    .select("id")
    .maybeSingle();
  if (error || !removed) throw error ?? new Error("missing");
}

export async function PATCH(request: Request) {
  const guard = await guardPlatform();
  if (!guard.ok)
    return NextResponse.json({ error: guard.error }, { status: guard.status });

  const actor = guard.context.user;
  if (!actor)
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  try {
    const input = patchSchema.parse(await request.json());
    const admin = createAdminClient();
    const { data: current, error: currentError } = await admin
      .from("organizations")
      .select("name,archived_at,service_status")
      .eq("id", input.organizationId)
      .maybeSingle();
    if (currentError || !current) throw currentError ?? new Error("missing");

    if (input.removeCompany) {
      if (input.confirmName !== current.name)
        return NextResponse.json(
          { error: "Escribe el nombre exacto de la empresa para eliminarla" },
          { status: 400 },
        );
      const name = current.name as string;
      await eraseCompany(admin, input.organizationId);
      const { error: logError } = await admin.from("platform_events").insert({
        actor_id: actor.id,
        event_type: "company_deleted",
        summary: `Eliminó ${name}`,
      });
      if (logError) console.error("Company delete log failed", logError);
      return NextResponse.json({ removed: true });
    }

    if (input.serviceStatus === "active" && current.archived_at && !input.restore)
      return NextResponse.json(
        { error: "Restaura la empresa para volver a activarla" },
        { status: 400 },
      );

    const payload: Record<string, string | null> = {};
    if (input.archive) {
      payload.service_status = "suspended";
      payload.archived_at = new Date().toISOString();
    } else if (input.restore) {
      payload.service_status = "active";
      payload.archived_at = null;
    } else if (input.serviceStatus) {
      payload.service_status = input.serviceStatus;
    }
    if (input.rotateKey) payload.access_key = createAccessKey();
    if (input.name) payload.name = input.name;

    let accessKey: string | undefined;
    let serviceStatus: string | undefined;
    if (Object.keys(payload).length) {
      const { data, error } = await admin
        .from("organizations")
        .update(payload)
        .eq("id", input.organizationId)
        .select("id,access_key,service_status,name")
        .maybeSingle();
      if (error || !data) throw error ?? new Error("missing");
      accessKey = data.access_key as string;
      serviceStatus = data.service_status as string;
    }

    if (input.archive)
      await logPlatformEvent({
        organizationId: input.organizationId,
        actorId: actor.id,
        eventType: "company_archived",
        summary: "Archivó la empresa. Las visitas se conservan",
      });
    else if (input.restore)
      await logPlatformEvent({
        organizationId: input.organizationId,
        actorId: actor.id,
        eventType: "company_restored",
        summary: "Restauró la empresa",
      });
    else if (input.serviceStatus === "suspended")
      await logPlatformEvent({
        organizationId: input.organizationId,
        actorId: actor.id,
        eventType: "service_paused",
        summary: "Pausó el servicio",
      });
    else if (input.serviceStatus === "active")
      await logPlatformEvent({
        organizationId: input.organizationId,
        actorId: actor.id,
        eventType: "service_resumed",
        summary: "Reactivó el servicio",
      });
    if (input.rotateKey)
      await logPlatformEvent({
        organizationId: input.organizationId,
        actorId: actor.id,
        eventType: "key_rotated",
        summary: "Generó una clave nueva",
      });

    let location: { id: string; name: string; address: string } | undefined;
    if (input.newLocation) {
      const { data: site, error } = await admin
        .from("locations")
        .insert({
          organization_id: input.organizationId,
          name: input.newLocation.name,
          address: input.newLocation.address,
          timezone: "America/Mexico_City",
        })
        .select("id,name,address")
        .single();
      if (error || !site) {
        const code = error && "code" in error ? String(error.code) : "";
        if (code === "23505")
          return NextResponse.json(
            { error: "Ya existe una sede con ese nombre" },
            { status: 400 },
          );
        throw error ?? new Error("sede");
      }
      location = {
        id: site.id as string,
        name: site.name as string,
        address: site.address as string,
      };
      await logPlatformEvent({
        organizationId: input.organizationId,
        actorId: actor.id,
        eventType: "company_updated",
        summary: `Agregó la sede ${input.newLocation.name}`,
      });
    }

    if (input.locations?.length) {
      for (const site of input.locations) {
        const { data: saved, error } = await admin
          .from("locations")
          .update({ name: site.name, address: site.address })
          .eq("id", site.id)
          .eq("organization_id", input.organizationId)
          .select("id")
          .maybeSingle();
        if (error || !saved) throw error ?? new Error("sede");
      }
    }
    if (input.name || input.locations?.length)
      await logPlatformEvent({
        organizationId: input.organizationId,
        actorId: actor.id,
        eventType: "company_updated",
        summary: "Actualizó el nombre o la sede",
      });

    const commercial =
      input.planName !== undefined ||
      input.monthlyAmount !== undefined ||
      input.currency !== undefined ||
      input.billingEmail !== undefined ||
      input.notes !== undefined;
    if (commercial) {
      const { error } = await admin.from("platform_accounts").upsert(
        {
          organization_id: input.organizationId,
          ...(input.planName !== undefined ? { plan_name: input.planName } : {}),
          ...(input.monthlyAmount !== undefined
            ? { monthly_amount: input.monthlyAmount }
            : {}),
          ...(input.currency !== undefined ? { currency: input.currency } : {}),
          ...(input.billingEmail !== undefined
            ? { billing_email: input.billingEmail || null }
            : {}),
          ...(input.notes !== undefined ? { notes: input.notes } : {}),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "organization_id" },
      );
      if (error) throw error;
    }

    if (input.payment) {
      const { error } = await admin.from("platform_payments").insert({
        organization_id: input.organizationId,
        amount: input.payment.amount,
        currency: input.payment.currency,
        paid_on: input.payment.paidOn,
        method: input.payment.method,
        reference: input.payment.reference ?? "",
        concept: input.payment.concept ?? "",
        recorded_by: actor.id,
      });
      if (error) throw error;
      const concept = input.payment.concept ? ` · ${input.payment.concept}` : "";
      await logPlatformEvent({
        organizationId: input.organizationId,
        actorId: actor.id,
        eventType: "payment_recorded",
        summary: `Registró un pago de ${input.payment.amount} ${input.payment.currency}${concept}`,
      });
    }

    let inviteUrl: string | undefined;
    let delivery: string | undefined;
    let accountRemoved = false;
    if (input.inviteMember) {
      const email = input.inviteMember.email.toLowerCase();
      const { data: org } = await admin
        .from("organizations")
        .select("name")
        .eq("id", input.organizationId)
        .maybeSingle();
      const { data: existing } = await admin
        .from("profiles")
        .select("id")
        .eq("email", email)
        .maybeSingle();
      let profileId = existing?.id as string | undefined;
      if (profileId) {
        const { data: membership } = await admin
          .from("organization_members")
          .select("status")
          .eq("organization_id", input.organizationId)
          .eq("profile_id", profileId)
          .maybeSingle();
        if (membership?.status === "active")
          return NextResponse.json(
            { error: "Esa persona ya está en la empresa" },
            { status: 409 },
          );
      }
      if (!profileId) {
        const created = await admin.auth.admin.createUser({
          email,
          email_confirm: false,
          user_metadata: { full_name: input.inviteMember.name },
        });
        profileId = created.data.user?.id;
        if (!profileId) {
          const { data: byEmail } = await admin
            .from("profiles")
            .select("id")
            .eq("email", email)
            .maybeSingle();
          profileId = byEmail?.id as string | undefined;
        }
      }
      if (!profileId)
        return NextResponse.json(
          { error: "No fue posible crear la cuenta de esa persona" },
          { status: 400 },
        );
      await admin.from("profiles").upsert(
        { id: profileId, full_name: input.inviteMember.name, email },
        { onConflict: "id" },
      );
      const { error: memberError } = await admin.from("organization_members").upsert(
        {
          organization_id: input.organizationId,
          profile_id: profileId,
          role: input.inviteMember.role,
          status: "invited",
          active: false,
          invited_by: actor.id,
        },
        { onConflict: "organization_id,profile_id" },
      );
      if (memberError) throw memberError;
      const issued = await issueTeamInvite({
        organizationId: input.organizationId,
        organizationName: (org?.name as string) ?? "NEXA",
        inviterId: actor.id,
        inviterName: guard.context.profile?.fullName ?? "NEXA",
        profileId,
        email,
        fullName: input.inviteMember.name,
        role: input.inviteMember.role,
      });
      inviteUrl = issued.inviteUrl;
      delivery = issued.delivery.status;
      await logPlatformEvent({
        organizationId: input.organizationId,
        actorId: actor.id,
        eventType: "company_updated",
        summary: `Invitó a ${input.inviteMember.name} como ${input.inviteMember.role}`,
      });
    }

    if (input.removeMemberId) {
      if (input.removeMemberId === actor.id)
        return NextResponse.json(
          { error: "No puedes borrar tu propia cuenta desde aquí" },
          { status: 400 },
        );
      const { data: person } = await admin
        .from("profiles")
        .select("full_name,email")
        .eq("id", input.removeMemberId)
        .maybeSingle();
      const email = ((person?.email as string | null) ?? "").toLowerCase();
      if (platformAdminEmails().includes(email))
        return NextResponse.json(
          { error: "Esa cuenta opera la consola" },
          { status: 400 },
        );
      const { data: membership } = await admin
        .from("organization_members")
        .select("profile_id")
        .eq("organization_id", input.organizationId)
        .eq("profile_id", input.removeMemberId)
        .maybeSingle();
      if (!membership)
        return NextResponse.json(
          { error: "Esa persona no está en la empresa" },
          { status: 404 },
        );
      const { error: requestError } = await admin
        .from("access_requests")
        .delete()
        .eq("organization_id", input.organizationId)
        .eq("profile_id", input.removeMemberId);
      if (requestError) throw requestError;
      const { error: inviteError } = await admin
        .from("team_invitations")
        .update({ revoked_at: new Date().toISOString() })
        .eq("organization_id", input.organizationId)
        .eq("profile_id", input.removeMemberId)
        .is("revoked_at", null);
      if (inviteError) throw inviteError;
      const { error: removed } = await admin
        .from("organization_members")
        .delete()
        .eq("organization_id", input.organizationId)
        .eq("profile_id", input.removeMemberId);
      if (removed) throw removed;
      const { count } = await admin
        .from("organization_members")
        .select("profile_id", { count: "exact", head: true })
        .eq("profile_id", input.removeMemberId);
      if ((count ?? 0) === 0) {
        const deleted = await admin.auth.admin.deleteUser(input.removeMemberId);
        accountRemoved = !deleted.error;
      }
      await logPlatformEvent({
        organizationId: input.organizationId,
        actorId: actor.id,
        eventType: "company_updated",
        summary: accountRemoved
          ? `Borró a ${person?.full_name ?? "una persona"} y su cuenta`
          : `Sacó a ${person?.full_name ?? "una persona"} de la empresa`,
      });
    }

    if (input.dismissRequestId) {
      const { data: requestRow, error } = await admin
        .from("access_requests")
        .delete()
        .eq("id", input.dismissRequestId)
        .eq("organization_id", input.organizationId)
        .select("id")
        .maybeSingle();
      if (error) throw error;
      if (!requestRow)
        return NextResponse.json(
          { error: "Esa solicitud ya no está" },
          { status: 404 },
        );
      await logPlatformEvent({
        organizationId: input.organizationId,
        actorId: actor.id,
        eventType: "company_updated",
        summary: "Descartó una solicitud de acceso",
      });
    }

    if (input.resendAdmin) {
      const { data: org } = await admin
        .from("organizations")
        .select("name")
        .eq("id", input.organizationId)
        .maybeSingle();
      const { data: pending } = await admin
        .from("organization_members")
        .select(
          "profile_id,role,profile:profiles!organization_members_profile_id_fkey(full_name,email)",
        )
        .eq("organization_id", input.organizationId)
        .eq("status", "invited")
        .in("role", ["admin", "superadmin"])
        .limit(1)
        .maybeSingle();
      const profile = pending?.profile as unknown as {
        full_name?: string;
        email?: string;
      } | null;
      if (!pending || !profile?.email)
        return NextResponse.json(
          { error: "Ese administrador ya aceptó la invitación" },
          { status: 400 },
        );
      const issued = await issueTeamInvite({
        organizationId: input.organizationId,
        organizationName: (org?.name as string) ?? "NEXA",
        inviterId: actor.id,
        inviterName: guard.context.profile?.fullName ?? "NEXA",
        profileId: pending.profile_id as string,
        email: profile.email,
        fullName: profile.full_name ?? profile.email,
        role: "admin",
      });
      inviteUrl = issued.inviteUrl;
      delivery = issued.delivery.status;
      await logPlatformEvent({
        organizationId: input.organizationId,
        actorId: actor.id,
        eventType: "admin_invite_resent",
        summary: `Reenvió la invitación a ${profile.full_name ?? profile.email}`,
      });
    }

    if (
      !Object.keys(payload).length &&
      !commercial &&
      !input.payment &&
      !input.resendAdmin &&
      !input.locations?.length &&
      !input.newLocation &&
      !input.inviteMember &&
      !input.removeMemberId &&
      !input.dismissRequestId
    )
      return NextResponse.json({ error: "Sin cambios" }, { status: 400 });

    return NextResponse.json({
      organizationId: input.organizationId,
      accessKey,
      serviceStatus,
      inviteUrl,
      delivery,
      location,
      accountRemoved,
    });
  } catch {
    return NextResponse.json({ error: "No fue posible actualizar la empresa" }, { status: 400 });
  }
}
