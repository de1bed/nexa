import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServerSupabase } from "./supabase";
import { isLiveMode, roleHome } from "@/lib/config";
import { ORG_COOKIE, SHOWCASE_ROLE_COOKIE } from "@/lib/session-constants";
import type { MemberRole } from "@/lib/domain";

export { ORG_COOKIE, SHOWCASE_ROLE_COOKIE } from "@/lib/session-constants";

export type Membership = {
  organizationId: string;
  organizationName: string;
  organizationSlug: string;
  role: MemberRole;
};

export type SessionProfile = {
  id: string;
  fullName: string;
  email: string;
};

export type SessionContext = {
  db: SupabaseClient;
  user: { id: string; email?: string } | null;
  profile: SessionProfile | null;
  memberships: Membership[];
  selected: Membership | null;
};

/**
 * Contexto de sesión real (Supabase Auth + membresías activas).
 * No redirige: las páginas usan `requirePortalRole` y las APIs `requireApiContext`.
 */
export async function getSessionContext(): Promise<SessionContext> {
  const db = await createServerSupabase();
  const {
    data: { user },
  } = await db.auth.getUser();

  if (!user)
    return { db, user: null, profile: null, memberships: [], selected: null };

  const [{ data: memberRows }, { data: profileRow }] = await Promise.all([
    db
      .from("organization_members")
      .select(
        "organization_id,role,organization:organizations!organization_members_organization_id_fkey(name,slug)",
      )
      .eq("profile_id", user.id)
      .eq("active", true),
    db.from("profiles").select("id,full_name,email").eq("id", user.id).single(),
  ]);

  const memberships: Membership[] = (memberRows ?? []).map((row) => {
    const organization = row.organization as unknown as {
      name?: string;
      slug?: string;
    } | null;
    return {
      organizationId: row.organization_id as string,
      role: row.role as MemberRole,
      organizationName: organization?.name ?? "Organización",
      organizationSlug: organization?.slug ?? "",
    };
  });

  const selectedId = (await cookies()).get(ORG_COOKIE)?.value;
  const selected =
    memberships.find((item) => item.organizationId === selectedId) ??
    (memberships.length === 1 ? memberships[0] : null);

  return {
    db,
    user: { id: user.id, email: user.email },
    profile: profileRow
      ? {
          id: profileRow.id as string,
          fullName: (profileRow.full_name as string) ?? "Usuario",
          email: (profileRow.email as string) ?? (user.email ?? ""),
        }
      : {
          id: user.id,
          fullName: user.email?.split("@")[0] ?? "Usuario",
          email: user.email ?? "",
        },
    memberships,
    selected,
  };
}

export type PortalContext = {
  role: MemberRole;
  organizationId: string;
  organizationName: string;
  userId: string;
  displayName: string;
  email: string;
  live: boolean;
};

const showcaseRoles: MemberRole[] = ["admin", "host", "guard"];

function showcaseIdentity(role: MemberRole) {
  const identities: Record<string, { id: string; name: string; email: string }> = {
    admin: { id: "demo-admin", name: "Elena Torres", email: "admin@novalogistics.demo" },
    host: { id: "host-mateo", name: "Mateo García", email: "mateo@novalogistics.demo" },
    guard: { id: "demo-guard", name: "Carlos Mendoza", email: "guardia1@novalogistics.demo" },
    superadmin: { id: "demo-admin", name: "Elena Torres", email: "admin@novalogistics.demo" },
  };
  return identities[role] ?? identities.admin;
}

/**
 * Guarda de portal para Server Components.
 *
 * Redirige siempre a `roleHome[rol]`, que por construcción es una ruta que ese
 * rol sí puede abrir: eso hace imposible el bucle de redirección.
 */
export async function requirePortalRole(
  roles: MemberRole[],
): Promise<PortalContext> {
  if (!isLiveMode()) {
    const stored = (await cookies()).get(SHOWCASE_ROLE_COOKIE)?.value;
    const role = (showcaseRoles as string[]).includes(stored ?? "")
      ? (stored as MemberRole)
      : "admin";
    if (!roles.includes(role)) redirect(roleHome[role]);
    const identity = showcaseIdentity(role);
    return {
      role,
      organizationId: "org-nova",
      organizationName: "Nova Logistics",
      userId: identity.id,
      displayName: identity.name,
      email: identity.email,
      live: false,
    };
  }

  const context = await getSessionContext();
  if (!context.user) redirect("/login");
  if (context.memberships.length === 0) redirect("/onboarding");
  if (!context.selected) redirect("/select-organization");
  if (!roles.includes(context.selected.role))
    redirect(roleHome[context.selected.role]);

  return {
    role: context.selected.role,
    organizationId: context.selected.organizationId,
    organizationName: context.selected.organizationName,
    userId: context.user.id,
    displayName: context.profile?.fullName ?? "Usuario",
    email: context.profile?.email ?? context.user.email ?? "",
    live: true,
  };
}

export type ApiContext = {
  db: SupabaseClient;
  userId: string;
  email: string;
  displayName: string;
  role: MemberRole;
  organizationId: string;
  organizationName: string;
};

export type ApiGuardResult =
  | { ok: true; context: ApiContext }
  | { ok: false; status: number; error: string };

/**
 * Guarda para Route Handlers. Devuelve un resultado tipado en vez de lanzar,
 * para que cada ruta responda con su propio código HTTP.
 */
export async function requireApiContext(
  roles?: MemberRole[],
): Promise<ApiGuardResult> {
  const context = await getSessionContext();
  if (!context.user)
    return { ok: false, status: 401, error: "No autenticado" };
  if (context.memberships.length === 0)
    return { ok: false, status: 403, error: "Sin organización asignada" };
  if (!context.selected)
    return { ok: false, status: 409, error: "Selecciona una organización" };
  if (roles && !roles.includes(context.selected.role))
    return { ok: false, status: 403, error: "Acceso denegado" };

  return {
    ok: true,
    context: {
      db: context.db,
      userId: context.user.id,
      email: context.profile?.email ?? context.user.email ?? "",
      displayName: context.profile?.fullName ?? "Usuario",
      role: context.selected.role,
      organizationId: context.selected.organizationId,
      organizationName: context.selected.organizationName,
    },
  };
}
