/** Correo interno. No es un buzón: el guardia nunca lo ve ni lo usa. */
export const GUARD_EMAIL_DOMAIN = "acceso.nexa";

const ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

export function isGuardAccessEmail(email: string) {
  return email.toLowerCase().endsWith(`@${GUARD_EMAIL_DOMAIN}`);
}

export function normalizeGuardCode(raw: string) {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function formatGuardCode(raw: string) {
  const code = normalizeGuardCode(raw);
  if (code.length !== 8) return code;
  return `${code.slice(0, 4)}-${code.slice(4)}`;
}

export function generateGuardCode() {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  let code = "";
  for (let index = 0; index < 8; index += 1) {
    code += ALPHABET[bytes[index] % ALPHABET.length];
  }
  return formatGuardCode(code);
}

export async function hashGuardCode(raw: string) {
  const data = new TextEncoder().encode(normalizeGuardCode(raw));
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}
