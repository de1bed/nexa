/**
 * Ventana de vida del QR.
 *
 * Quien invita elige cuántos días dura, de 1 a 365, contados desde el inicio
 * de la visita. El código empieza a resolverse al emitirse. Si esa cuenta
 * ya quedó atrás, el pase no vence en el pasado.
 */

export const PASS_MIN_DAYS = 1;
export const PASS_MAX_DAYS = 365;
export const PASS_DAY_MS = 24 * 60 * 60 * 1000;
const PASS_MIN_LIFE_MS = 4 * 60 * 60 * 1000;

export function clampPassDays(value: unknown) {
  const days = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(days)) return PASS_MIN_DAYS;
  return Math.min(PASS_MAX_DAYS, Math.max(PASS_MIN_DAYS, days));
}

export function passExpiresAt(startsAt: string, validDays = PASS_MIN_DAYS) {
  const start = new Date(startsAt).getTime();
  return new Date(start + clampPassDays(validDays) * PASS_DAY_MS).toISOString();
}

export function passValidityWindow(input: {
  startsAt: string;
  endsAt: string;
  validDays?: number;
  issuedAt?: Date | string;
}) {
  const issued = input.issuedAt ? new Date(input.issuedAt) : new Date();
  const expiresAt = Math.max(
    new Date(passExpiresAt(input.startsAt, input.validDays)).getTime(),
    issued.getTime() + PASS_MIN_LIFE_MS,
  );

  return {
    valid_from: issued.toISOString(),
    expires_at: new Date(expiresAt).toISOString(),
  };
}
