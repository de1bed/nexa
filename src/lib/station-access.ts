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

/** El usuario de la tableta sale del nombre de la caseta elegida. */
export function usernameFromBooth(name: string) {
  const slug = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "")
    .slice(0, 32);
  const candidate = slug.length >= 3 ? slug : `caseta.${slug || "uno"}`;
  return isStationUsername(candidate) ? candidate.slice(0, 32) : "caseta.nueva";
}
