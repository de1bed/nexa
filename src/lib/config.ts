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
import { safeInternalPath } from "./security";

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

const genericHomes = new Set([
  "/app",
  "/app/dashboard",
  "/app/host",
  "/guard",
  "/guard/scan",
]);

/**
 * Destino tras autenticarse. Si la cuenta tiene varias empresas, se pregunta
 * aunque exista una cookie de la última visita (eso era lo que saltaba el
 * selector). Un `next` concreto (visita, invitación) sí se respeta.
 */
export function destinationAfterLogin(options: {
  memberships: Array<{ role: keyof typeof roleHome }>;
  next?: string | null;
}) {
  const requested = safeInternalPath(options.next ?? null, "");
  const hasSpecificNext = Boolean(requested) && !genericHomes.has(requested);

  if (hasSpecificNext) return requested;
  if (options.memberships.length === 0) return "/onboarding";
  if (options.memberships.length > 1) return "/select-organization";
  return roleHome[options.memberships[0].role];
}
