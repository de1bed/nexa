/**
 * Ventana de vida del QR.
 *
 * Distinta de la ventana de caseta (`accessWindow`): el código empieza a
 * resolverse en el momento en que se emite, y sigue sirviendo un día después
 * del fin programado. Llegar temprano o tarde lo decide el guardia con el
 * horario de la visita, no el QR.
 */

export const PASS_GRACE_AFTER_END_MS = 24 * 60 * 60 * 1000;
const PASS_MIN_LIFE_MS = 4 * 60 * 60 * 1000;

export function passValidityWindow(input: {
  startsAt: string;
  endsAt: string;
  issuedAt?: Date | string;
}) {
  const issued = input.issuedAt ? new Date(input.issuedAt) : new Date();
  const ends = new Date(input.endsAt).getTime();
  const expiresAt = Math.max(
    ends + PASS_GRACE_AFTER_END_MS,
    issued.getTime() + PASS_MIN_LIFE_MS,
  );

  return {
    valid_from: issued.toISOString(),
    expires_at: new Date(expiresAt).toISOString(),
  };
}
