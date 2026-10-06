/**
 * Retención de documentos del visitante.
 *
 * Ilimitada (la opción por omisión) significa que el documento no tiene fecha
 * de borrado: `retention_expires_at` queda en null y el cron nunca lo purga.
 */

export const DEFAULT_RETENTION_DAYS = 30;

export const retentionDayOptions = [7, 15, 30, 60, 90] as const;

export function retentionExpiresAt(
  policy: { unlimited: boolean; days: number },
  from = Date.now(),
): string | null {
  if (policy.unlimited) return null;
  return new Date(from + policy.days * 86400000).toISOString();
}
