import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/server/supabase";
import { safeInternalPath } from "@/lib/security";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  // Solo rutas internas: bloquea `//evil.com` y cualquier destino absoluto.
  const next = safeInternalPath(url.searchParams.get("next"), "/app");

  if (code) {
    const db = await createServerSupabase();
    const { error } = await db.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, url.origin));
  }

  return NextResponse.redirect(
    new URL("/login?error=invalid_link", url.origin),
  );
}
