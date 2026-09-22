import "server-only";
import { createAdminClient } from "./supabase-admin";

/** Única cuenta que abre la consola. No se amplía desde el cliente ni con variables. */
const PLATFORM_OWNER_EMAIL = "davidrocha0520@gmail.com";
const PLATFORM_OWNER_ID = "4f2eee67-0d2d-4041-bb07-a1b9e65bb227";

export function platformAdminEmails() {
  return [PLATFORM_OWNER_EMAIL];
}

export async function isPlatformAdmin(userId: string, email: string) {
  const normalized = email.trim().toLowerCase();
  if (normalized !== PLATFORM_OWNER_EMAIL || userId !== PLATFORM_OWNER_ID)
    return false;
  const admin = createAdminClient();
  if (normalized && platformAdminEmails().includes(normalized)) {
    const { data: profile } = await admin
      .from("profiles")
      .select("id")
      .eq("id", userId)
      .maybeSingle();
    if (!profile) {
      await admin.from("profiles").insert({
        id: userId,
        email: normalized,
        full_name: normalized.split("@")[0] ?? "NEXA",
      });
    }
    await admin
      .from("platform_admins")
      .upsert({ profile_id: userId, email: normalized }, { onConflict: "profile_id" });
    return true;
  }
  return false;
}
