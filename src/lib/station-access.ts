/** Usuario de tableta y clave de empresa. El guardia no los vuelve a ver. */

export function normalizeCompanyCode(raw: string) {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function formatCompanyCode(raw: string) {
  const code = normalizeCompanyCode(raw);
  if (code.startsWith("NEXA") && code.length > 4)
    return `NEXA-${code.slice(4)}`;
  if (code.startsWith("NOVA") && code.length > 4)
    return `NOVA-${code.slice(4)}`;
  return code;
}

export function normalizeStationUsername(raw: string) {
  return raw.trim().toLowerCase().replace(/\s+/g, "");
}

export function isStationUsername(raw: string) {
  return /^[a-z0-9][a-z0-9._-]{2,31}$/.test(normalizeStationUsername(raw));
}

function slugPart(name: string) {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "");
}

/**
 * El usuario de la tableta sale del nombre de la caseta elegida.
 * Si ya existe (la misma «Caseta principal» en dos sedes), se le antepone la
 * sede, y si aun así choca, un número: nunca se bloquea el alta.
 */
export function usernameFromBooth(
  name: string,
  options: { site?: string; taken?: Iterable<string> } = {},
) {
  const taken = new Set(options.taken ?? []);
  const base = slugPart(name).slice(0, 32);
  const first = base.length >= 3 ? base : `caseta.${base || "uno"}`;
  const candidates = [first];
  const site = slugPart(options.site ?? "");
  if (site) candidates.push(`${site}.${first}`.slice(0, 32).replace(/\.+$/g, ""));
  for (const candidate of candidates)
    if (isStationUsername(candidate) && !taken.has(candidate)) return candidate;
  const stem = (candidates.at(-1) ?? "caseta").slice(0, 28).replace(/\.+$/g, "");
  for (let index = 2; index < 100; index += 1) {
    const candidate = `${stem}.${index}`;
    if (isStationUsername(candidate) && !taken.has(candidate)) return candidate;
  }
  return isStationUsername(first) ? first : "caseta.nueva";
}
