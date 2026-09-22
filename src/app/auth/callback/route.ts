import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerSupabase } from "@/lib/server/supabase";
import { getSessionContext, ORG_COOKIE } from "@/lib/server/session";
import { destinationAfterLogin } from "@/lib/config";
import { isPlatformAdmin } from "@/lib/server/platform-admin";
import { safeInternalPath } from "@/lib/security";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  // Solo rutas internas: bloquea `//evil.com` y cualquier destino absoluto.
  const next = safeInternalPath(url.searchParams.get("next"), "");

  if (code) {
    const db = await createServerSupabase();
    const { error } = await db.auth.exchangeCodeForSession(code);
    if (!error) {
      const context = await getSessionContext();
      let destination = destinationAfterLogin({
        memberships: context.memberships,
        next,
      });
      if (context.user && context.memberships.length === 0) {
        const platform = await isPlatformAdmin(
          context.user.id,
          context.profile?.email ?? context.user.email ?? "",
        ).catch(() => false);
        if (platform) destination = "/platform";
      }
      if (destination === "/select-organization") {
        (await cookies()).delete({ name: ORG_COOKIE, path: "/" });
      }
      return NextResponse.redirect(new URL(destination, url.origin));
    }
  }

  return NextResponse.redirect(
    new URL("/login?error=invalid_link", url.origin),
  );
}
