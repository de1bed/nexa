/** Día civil local, AAAA-MM-DD. No usa el día UTC del ISO. */

export function localDayKey(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

export function shiftLocalDay(offsetDays: number, from = new Date()) {
  const date = new Date(from);
  date.setDate(date.getDate() + offsetDays);
  return localDayKey(date);
}

/** Lunes local de la semana que contiene la fecha. */
export function localWeekKey(value: string | Date) {
  const date = value instanceof Date ? new Date(value) : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const mondayOffset = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - mondayOffset);
  return localDayKey(date);
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
  if (preset === "year") return { from: `${from.getFullYear()}-01-01`, to };
  return { from: shiftLocalDay(-29, from), to };
}

export function parseLocalDay(key: string) {
  const [year, month, day] = key.split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}
