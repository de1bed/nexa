import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/server/supabase";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") ?? "/update-password";
  if (code) {
    const db = await createServerSupabase();
    const { error } = await db.auth.exchangeCodeForSession(code);
    if (!error)
      return NextResponse.redirect(
        new URL(next.startsWith("/") ? next : "/update-password", url.origin),
      );
  }
  return NextResponse.redirect(
    new URL("/forgot-password?error=invalid_link", url.origin),
  );
}
