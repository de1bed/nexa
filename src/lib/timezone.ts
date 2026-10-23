/**
 * Horarios de visita: se interpretan y se pintan en la zona de la sede.
 * Tijuana es el valor por omisión de la operación; una sede puede traer otra.
 */

export const APP_TIME_ZONE = "America/Tijuana";

function partNumber(
  parts: Intl.DateTimeFormatPart[],
  type: Intl.DateTimeFormatPartTypes,
) {
  return Number(parts.find((part) => part.type === type)?.value);
}

function zoneOffsetMs(instant: number, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(instant));
  const asUtc = Date.UTC(
    partNumber(parts, "year"),
    partNumber(parts, "month") - 1,
    partNumber(parts, "day"),
    partNumber(parts, "hour"),
    partNumber(parts, "minute"),
    partNumber(parts, "second"),
  );
  return asUtc - instant;
}

/** IANA válido, o Tijuana si el valor no existe. */
export function resolveTimeZone(value?: string | null) {
  const zone = value?.trim();
  if (!zone) return APP_TIME_ZONE;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: zone }).format();
    return zone;
  } catch {
    return APP_TIME_ZONE;
  }
}

/**
 * Convierte fecha + hora de pared (`2026-10-23`, `08:00`) en un instante UTC
 * usando la zona indicada. No usa la zona del navegador ni la del servidor.
 */
export function zonedDateTime(
  date: string,
  time: string,
  timeZone = APP_TIME_ZONE,
): Date {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date.trim());
  const timeMatch = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(time.trim());
  if (!dateMatch || !timeMatch) return new Date(Number.NaN);

  const year = Number(dateMatch[1]);
  const month = Number(dateMatch[2]);
  const day = Number(dateMatch[3]);
  const hour = Number(timeMatch[1]);
  const minute = Number(timeMatch[2]);
  const second = Number(timeMatch[3] ?? 0);
  if (
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31 ||
    hour > 23 ||
    minute > 59 ||
    second > 59
  ) {
    return new Date(Number.NaN);
  }

  const zone = resolveTimeZone(timeZone);
  const desired = Date.UTC(year, month - 1, day, hour, minute, second);
  let instant = desired - zoneOffsetMs(desired, zone);
  instant = desired - zoneOffsetMs(instant, zone);
  return new Date(instant);
}

export function zonedDateTimeToIso(
  date: string,
  time: string,
  timeZone = APP_TIME_ZONE,
) {
  const value = zonedDateTime(date, time, timeZone);
  if (Number.isNaN(value.getTime())) return "";
  return value.toISOString();
}

export function formatInTimeZone(
  value: Date | string,
  options: Intl.DateTimeFormatOptions,
  locale = "es-MX",
  timeZone = APP_TIME_ZONE,
) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(locale, {
    ...options,
    timeZone: resolveTimeZone(timeZone),
  }).format(date);
}

/** Fecha y hora largas para correos e invitaciones. */
export function formatDateTimeLabel(
  value: Date | string,
  timeZone = APP_TIME_ZONE,
  locale = "es-MX",
) {
  return formatInTimeZone(
    value,
    { dateStyle: "full", timeStyle: "short" },
    locale,
    timeZone,
  );
}

/** Fecha media + hora, para pases y tarjetas. */
export function formatDateTimeMedium(
  value: Date | string,
  timeZone = APP_TIME_ZONE,
  locale = "es-MX",
) {
  return formatInTimeZone(
    value,
    { dateStyle: "medium", timeStyle: "short" },
    locale,
    timeZone,
  );
}

/** Solo la hora, para el aviso de llegada. */
export function formatTimeLabel(
  value: Date | string,
  timeZone = APP_TIME_ZONE,
  locale = "es-MX",
) {
  return formatInTimeZone(value, { timeStyle: "short" }, locale, timeZone);
}

/** `AAAA-MM-DD` calendario en la zona, opcionalmente corrido N días. */
export function calendarDateInTimeZone(
  timeZone = APP_TIME_ZONE,
  at = new Date(),
  plusDays = 0,
) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: resolveTimeZone(timeZone),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(at);
  const utc = Date.UTC(
    partNumber(parts, "year"),
    partNumber(parts, "month") - 1,
    partNumber(parts, "day") + plusDays,
  );
  const shifted = new Date(utc);
  return [
    shifted.getUTCFullYear(),
    String(shifted.getUTCMonth() + 1).padStart(2, "0"),
    String(shifted.getUTCDate()).padStart(2, "0"),
  ].join("-");
}
