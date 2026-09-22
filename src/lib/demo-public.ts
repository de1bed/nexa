import { DEMO_COOKIE, SHOWCASE_ROLE_COOKIE } from "./session-constants";
import type { MemberRole } from "./domain";

/** Pase e invitación de la empresa de ejemplo. Sirven en cualquier teléfono. */
export const DEMO_PASS_TOKEN = "nexa-demo-pass-2026";
export const DEMO_INVITE_TOKEN = "nexa-demo-invitation-2026";

export function isKnownDemoToken(token: string) {
  return token === DEMO_PASS_TOKEN || token === DEMO_INVITE_TOKEN;
}

/** El lector acepta el token solo o una URL /pass o /visit. */
export function tokenFromScan(raw: string) {
  const trimmed = raw.trim();
  try {
    const url = new URL(trimmed);
    const parts = url.pathname.split("/").filter(Boolean);
    const index = parts.findIndex((part) => part === "pass" || part === "visit");
    if (index >= 0 && parts[index + 1]) return decodeURIComponent(parts[index + 1]);
  } catch {
    // El código trae el token en texto, sin URL.
  }
  return trimmed;
}

export function readDemoCookie() {
  if (typeof document === "undefined") return false;
  return document.cookie.split(";").some((part) => part.trim() === `${DEMO_COOKIE}=1`);
}

export function writeDemoSession(role: Exclude<MemberRole, "superadmin">) {
  document.cookie = `${DEMO_COOKIE}=1; path=/; max-age=86400; samesite=lax`;
  document.cookie = `${SHOWCASE_ROLE_COOKIE}=${role}; path=/; max-age=86400; samesite=lax`;
}

export function clearDemoSession() {
  document.cookie = `${DEMO_COOKIE}=; path=/; max-age=0; samesite=lax`;
  document.cookie = `${SHOWCASE_ROLE_COOKIE}=; path=/; max-age=0; samesite=lax`;
}
