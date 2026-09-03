/**
 * Detección única del modo de operación.
 *
 * La regla es fail-closed: en cuanto existan credenciales de Supabase la
 * plataforma opera contra la base de datos real y exige autenticación. El modo
 * vitrina (datos locales en el navegador) solo se activa cuando no hay
 * credenciales, o cuando se pide explícitamente con NEXT_PUBLIC_DEMO_MODE=true.
 *
 * Conectar Supabase es, por tanto, la única acción necesaria para pasar a
 * producción: no hay que tocar código.
 */
export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export function isSupabaseConfigured() {
  return Boolean(supabaseUrl && supabaseAnonKey);
}

/** Vitrina forzada por variable de entorno. */
export function isShowcaseForced() {
  return process.env.NEXT_PUBLIC_DEMO_MODE === "true";
}

/** `true` cuando la plataforma trabaja contra Supabase y Auth reales. */
export function isLiveMode() {
  return isSupabaseConfigured() && !isShowcaseForced();
}

/** `true` cuando la plataforma usa el recorrido local de evaluación. */
export function isShowcaseMode() {
  return !isLiveMode();
}

export function appUrl() {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, "");
  if (configured) return configured;
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL)
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

/** Ruta inicial de cada rol. Es la fuente única para evitar redirecciones circulares. */
export const roleHome = {
  superadmin: "/app/dashboard",
  admin: "/app/dashboard",
  host: "/app/host",
  guard: "/guard/scan",
} as const;
