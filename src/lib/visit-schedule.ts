/** Un minuto de margen para el reloj del teléfono. */
const GRACE_MS = 60_000;

export function visitStartsInPast(startsAt: Date, now = Date.now()) {
  return startsAt.getTime() < now - GRACE_MS;
}
