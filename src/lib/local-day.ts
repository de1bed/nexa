import { APP_TIME_ZONE, calendarDateInTimeZone } from "./timezone";

/**
 * Día civil de la operación (Tijuana), AAAA-MM-DD.
 * No usa el día UTC del ISO ni la zona del navegador: una computadora con la
 * hora del centro contaba una visita de las 11 p.m. en el día siguiente.
 */
export function localDayKey(value: string | Date, timeZone = APP_TIME_ZONE) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return calendarDateInTimeZone(timeZone, date);
}

export function shiftLocalDay(offsetDays: number, from = new Date()) {
  return calendarDateInTimeZone(APP_TIME_ZONE, from, offsetDays);
}

/** Suma días a una clave AAAA-MM-DD sin pasar por ninguna zona. */
function addDaysToKey(key: string, days: number) {
  const [year, month, day] = key.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day + days));
  return shifted.toISOString().slice(0, 10);
}

/** Lunes de la semana (en Tijuana) que contiene la fecha. */
export function localWeekKey(value: string | Date) {
  const key = localDayKey(value);
  if (!key) return "";
  const [year, month, day] = key.split("-").map(Number);
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return addDaysToKey(key, -((weekday + 6) % 7));
}

export function localMonthKey(value: string | Date) {
  return localDayKey(value).slice(0, 7);
}

export function localYearKey(value: string | Date) {
  return localDayKey(value).slice(0, 4);
}

export type ReportPreset = "today" | "week" | "month" | "year" | "last30";

/** Rango civil local que usa la bitácora al elegir hoy, semana, mes o año. */
export function reportRange(preset: ReportPreset, from = new Date()) {
  const to = localDayKey(from);
  if (preset === "today") return { from: to, to };
  if (preset === "week") return { from: localWeekKey(from), to };
  if (preset === "month") return { from: `${localMonthKey(from)}-01`, to };
  if (preset === "year") return { from: `${to.slice(0, 4)}-01-01`, to };
  return { from: shiftLocalDay(-29, from), to };
}

export function parseLocalDay(key: string) {
  const [year, month, day] = key.split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}
