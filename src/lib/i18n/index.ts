import { getLocale } from "./store";
import { localeIntl, type Locale } from "./types";
import { translate } from "./catalog";

type Vars = Record<string, string | number>;

export { translate } from "./catalog";

export function t(path: string, vars?: Vars) {
  return translate(path, vars, getLocale());
}

export function intlLocale(locale: Locale = getLocale()) {
  return localeIntl[locale];
}

export function formatDateTime(value: string | Date, locale: Locale = getLocale()) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(intlLocale(locale), {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function formatDate(value: string | Date, locale: Locale = getLocale()) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(intlLocale(locale), {
    dateStyle: "medium",
  }).format(date);
}

export function formatTime(value: string | Date, locale: Locale = getLocale()) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(intlLocale(locale), {
    timeStyle: "short",
  }).format(date);
}

export function formatWeekday(value: Date, locale: Locale = getLocale()) {
  return new Intl.DateTimeFormat(intlLocale(locale), { weekday: "short" }).format(
    value,
  );
}

export function formatFullDate(value: string | Date, locale: Locale = getLocale()) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(intlLocale(locale), {
    dateStyle: "full",
    timeStyle: "short",
  }).format(date);
}

export function formatDurationI18n(ms: number, locale: Locale = getLocale()) {
  const totalMinutes = Math.floor(ms / 60000);
  if (totalMinutes < 1) return translate("duration.underMinute", undefined, locale);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return translate("duration.minutes", { n: minutes }, locale);
  if (minutes === 0) return translate("duration.hours", { n: hours }, locale);
  return translate("duration.hoursMinutes", { h: hours, m: minutes }, locale);
}

export { catalogs } from "./messages";
export { getLocale, setLocale, useLocale, hydrateLocale } from "./store";
export type { Locale } from "./types";
export { localeFromCookieHeader } from "./types";

const documentTypeKeys: Record<string, string> = {
  "INE / IFE": "docs.ine",
  "Pasaporte": "docs.passport",
  "Licencia de conducir": "docs.license",
  "Cédula profesional": "docs.professional",
  "Credencial laboral": "docs.work",
  Otra: "docs.other",
};

export function documentTypeMessageKey(type: string) {
  return documentTypeKeys[type] ?? "";
}
