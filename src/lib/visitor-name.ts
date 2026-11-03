/**
 * Nombres que no identifican a la persona. El pase no debe quedarse con uno
 * de estos si el visitante ya escribió el suyo.
 */
const PLACEHOLDER_VISITOR_NAMES = new Set([
  "por confirmar",
  "visitante",
  "datos pendientes",
  "visitor",
  "pending",
  "pending data",
]);

export function isPlaceholderVisitorName(value?: string | null) {
  const text = value?.trim().toLowerCase().replace(/\s+/g, " ") ?? "";
  return text.length === 0 || PLACEHOLDER_VISITOR_NAMES.has(text);
}

/**
 * Elige el nombre que se muestra en el pase.
 * Un nombre real gana sobre «Visitante», «Por confirmar» o «datos pendientes».
 * Si solo hay un respaldo ya guardado, se conserva: los pases viejos no cambian.
 */
export function displayVisitorName(
  names: Array<string | null | undefined>,
  fallback: string,
) {
  for (const name of names) {
    const text = name?.trim() ?? "";
    if (text && !isPlaceholderVisitorName(text)) return text;
  }
  for (const name of names) {
    const text = name?.trim() ?? "";
    if (text) return text;
  }
  return fallback;
}

export type VisitorMatch = {
  id: string;
  email?: string | null;
  phone?: string | null;
};

/**
 * Reutiliza un visitante de la misma empresa solo cuando el correo o el
 * teléfono apuntan a una sola ficha. Si cada dato apunta a una persona
 * distinta, no se mezcla.
 */
export function matchVisitorId(
  rows: VisitorMatch[],
  email: string,
  phone: string,
): string | null {
  const mail = email.trim().toLowerCase();
  const digits = phone.replace(/\D/g, "");
  const byId = new Map<string, VisitorMatch>();
  for (const row of rows) byId.set(row.id, row);
  const unique = [...byId.values()];

  const mailHits =
    mail.includes("@")
      ? unique.filter((row) => (row.email ?? "").trim().toLowerCase() === mail)
      : [];
  const phoneHits =
    digits.length >= 7
      ? unique.filter((row) => (row.phone ?? "").replace(/\D/g, "") === digits)
      : [];

  if (mailHits.length > 1 || phoneHits.length > 1) return null;
  if (
    mailHits.length === 1 &&
    phoneHits.length === 1 &&
    mailHits[0]?.id !== phoneHits[0]?.id
  ) {
    return null;
  }
  return mailHits[0]?.id ?? phoneHits[0]?.id ?? null;
}

/** Escapa comodines de ILIKE para buscar el correo tal cual. */
export function escapeIlike(value: string) {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}
