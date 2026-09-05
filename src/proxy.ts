import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { isLiveMode, supabaseAnonKey, supabaseUrl } from "@/lib/config";

/**
 * Proxy (antes Middleware). Cumple dos funciones:
 *
 * 1. Refresca el token de Supabase en cada navegación, para que las sesiones
 *    largas no caduquen dentro de un Server Component.
 * 2. Comprobación optimista de sesión antes de entrar a los portales.
 *
 * La autorización real vive en `requirePortalRole`, en las Route Handlers y en
 * las políticas RLS: esto solo evita pintar una pantalla que va a redirigir.
 */

const publicPrefixes = [
  "/login",
  "/signup",
  "/onboarding",
  "/auth",
  "/visit",
  "/pass",
  "/demo",
  "/api/public",
  "/api/cron",
];

function isProtected(pathname: string) {
  if (pathname === "/") return false;
  if (publicPrefixes.some((prefix) => pathname.startsWith(prefix))) return false;
  return (
    pathname.startsWith("/app") ||
    pathname.startsWith("/guard") ||
    pathname.startsWith("/select-organization")
  );
}

export async function proxy(request: NextRequest) {
  if (!isLiveMode()) return NextResponse.next();

  let response = NextResponse.next({ request });

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (values) => {
        values.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        values.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && isProtected(request.nextUrl.pathname)) {
    const login = request.nextUrl.clone();
    login.pathname = "/login";
    login.search = `?next=${encodeURIComponent(request.nextUrl.pathname)}`;
    return NextResponse.redirect(login);
  }

  return response;
}

export const config = {
  matcher: [
    // Todo excepto estáticos, imágenes y el favicon.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
