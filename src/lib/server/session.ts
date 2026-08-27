import "server-only";
import { cookies } from "next/headers";
import { createServerSupabase } from "./supabase";
import type { MemberRole } from "@/lib/domain";
import { redirect } from "next/navigation";

export type Membership = {
  organizationId: string;
  organizationName: string;
  role: MemberRole;
};

export async function getSessionContext() {
  const db = await createServerSupabase();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user)
    return { db, user: null, memberships: [] as Membership[], selected: null };
  const { data } = await db
    .from("organization_members")
    .select(
      "organization_id,role,organization:organizations!organization_members_organization_id_fkey(name)",
    )
    .eq("profile_id", user.id)
    .eq("active", true);
  const memberships: Membership[] = (data ?? []).map((row) => ({
    organizationId: row.organization_id,
    role: row.role as MemberRole,
    organizationName:
      (row.organization as unknown as { name?: string } | null)?.name ??
      "Organización",
  }));
  const selectedId = (await cookies()).get("nexa-org")?.value;
  const selected =
    memberships.find(
      (membership) => membership.organizationId === selectedId,
    ) ?? (memberships.length === 1 ? memberships[0] : null);
  return { db, user, memberships, selected };
}

export async function requirePortalRole(roles: MemberRole[]) {
  if (process.env.NEXT_PUBLIC_DEMO_MODE !== "false") return null;
  const context = await getSessionContext();
  if (!context.user) redirect("/login");
  if (!context.selected) redirect("/select-organization");
  if (!roles.includes(context.selected.role))
    redirect(
      context.selected.role === "guard" ? "/guard/scan" : "/app/dashboard",
    );
  return context;
}
