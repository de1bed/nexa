/** Idioma de la interfaz. El producto nace en español; el inglés es opcional. */

export const locales = ["es", "en"] as const;
export type Locale = (typeof locales)[number];

export const localeLabels: Record<Locale, string> = {
  es: "Español",
  en: "English",
};

export const localeIntl: Record<Locale, string> = {
  es: "es-MX",
  en: "en-US",
};

export const LOCALE_COOKIE = "nexa-locale";
export const LOCALE_STORAGE_KEY = "nexa-visit-locale";

export function isLocale(value: unknown): value is Locale {
  return value === "es" || value === "en";
}

export function interpolate(
  template: string,
  vars?: Record<string, string | number>,
) {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_, key: string) =>
    vars[key] === undefined ? `{${key}}` : String(vars[key]),
  );
}

export function localeFromCookieHeader(header: string | null | undefined): Locale {
  const match = header?.match(new RegExp(`(?:^|; )${LOCALE_COOKIE}=(es|en)(?:;|$)`));
  return isLocale(match?.[1]) ? match[1] : "es";
}
