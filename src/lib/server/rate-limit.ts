import "server-only";
const attempts = new Map<string, { count: number; reset: number }>();
export function rateLimit(key: string, limit = 12, windowMs = 60000) {
  const now = Date.now();
  const hit = attempts.get(key);
  if (!hit || hit.reset <= now) {
    attempts.set(key, { count: 1, reset: now + windowMs });
    return { allowed: true, remaining: limit - 1 };
  }
  hit.count++;
  return {
    allowed: hit.count <= limit,
    remaining: Math.max(0, limit - hit.count),
    retryAfter: Math.ceil((hit.reset - now) / 1000),
  };
}
