import "server-only";
import { createAdminClient } from "./supabase-admin";

/** Correos que pueden abrir la consola. Se definen en el servidor, nunca en el cliente. */
export function platformAdminEmails() {
  return (process.env.PLATFORM_ADMIN_EMAILS ?? "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

export async function isPlatformAdmin(userId: string, email: string) {
  const normalized = email.trim().toLowerCase();
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
  const { data } = await admin
    .from("platform_admins")
    .select("profile_id")
    .eq("profile_id", userId)
    .maybeSingle();
  return Boolean(data);
}
