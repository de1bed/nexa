/** Utilidades de seguridad compartidas por servidor y navegador. */

/** SHA-256 en hexadecimal; mismo resultado que `public.token_hash` en PostgreSQL. */
export async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(hash)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

/** Token opaco base64url, seguro para URLs y códigos QR. */
export function randomToken(bytes = 32) {
  const data = new Uint8Array(bytes);
  crypto.getRandomValues(data);
  return btoa(String.fromCharCode(...data))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

/** Deja visibles solo los últimos cuatro caracteres de una identificación. */
export function maskDocument(value: string) {
  const clean = value.replace(/\s/g, "");
  return clean.length <= 4 ? "••••" : `•••• ${clean.slice(-4)}`;
}

/** Enmascara un correo conservando dominio: `m•••@empresa.com`. */
export function maskEmail(value: string) {
  return value.replace(/(^.)(.*)(@.*$)/, (_, first, _middle, domain) => `${first}•••${domain}`);
}

/** Enmascara un teléfono conservando los últimos cuatro dígitos. */
export function maskPhone(value: string) {
  const digits = value.replace(/\D/g, "");
  return digits.length <= 4 ? "••••" : `•••• ${digits.slice(-4)}`;
}

/** Envuelve una celda CSV y neutraliza fórmulas de hoja de cálculo. */
export function safeCsvCell(value: unknown) {
  const text = String(value ?? "");
  const guarded = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return `"${guarded.replaceAll('"', '""')}"`;
}

/**
 * Solo se aceptan rutas internas. Bloquea `//evil.com`, `\\evil.com`,
 * `https://evil.com` y cualquier variante de redirección abierta.
 */
export function safeInternalPath(value: string | null, fallback: string) {
  if (!value) return fallback;
  const candidate = value.trim();
  if (!candidate.startsWith("/")) return fallback;
  if (candidate.startsWith("//") || candidate.startsWith("/\\")) return fallback;
  if (candidate.includes("\\")) return fallback;
  return candidate;
}

/** Escapa texto para interpolarlo con seguridad dentro de HTML (correos). */
export function escapeHtml(value: string) {
  return value.replace(
    /[&<>'"]/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "'": "&#39;",
        '"': "&quot;",
      })[character]!,
  );
}
