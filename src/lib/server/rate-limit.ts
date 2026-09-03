import "server-only";

/**
 * Contador en memoria por instancia. Suficiente para un despliegue de un solo
 * proceso y para frenar abuso trivial de los endpoints públicos; en serverless
 * con varias instancias debe sustituirse por Postgres o KV (ver
 * docs/PRODUCTION_CHECKLIST.md).
 */
const attempts = new Map<string, { count: number; reset: number }>();
const MAX_ENTRIES = 10000;

function sweep(now: number) {
  if (attempts.size < MAX_ENTRIES) return;
  for (const [key, value] of attempts) if (value.reset <= now) attempts.delete(key);
}

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfter: number;
};

export function rateLimit(key: string, limit = 12, windowMs = 60000): RateLimitResult {
  const now = Date.now();
  sweep(now);
  const hit = attempts.get(key);

  if (!hit || hit.reset <= now) {
    attempts.set(key, { count: 1, reset: now + windowMs });
    return { allowed: true, remaining: limit - 1, retryAfter: 0 };
  }

  hit.count += 1;
  return {
    allowed: hit.count <= limit,
    remaining: Math.max(0, limit - hit.count),
    retryAfter: Math.max(1, Math.ceil((hit.reset - now) / 1000)),
  };
}

/** Identidad de origen para endpoints públicos. */
export function requestOrigin(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return request.headers.get("x-real-ip") ?? "local";
}
