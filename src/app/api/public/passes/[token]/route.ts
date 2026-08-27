import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { createAdminClient } from "@/lib/server/supabase-admin";
import { rateLimit } from "@/lib/server/rate-limit";

export async function GET(
  request: Request,
  ctx: RouteContext<"/api/public/passes/[token]">,
) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0] ?? "local";
  if (!rateLimit(`pass:${ip}`, 20, 60000).allowed)
    return NextResponse.json({ error: "Demasiados intentos" }, { status: 429 });
  try {
    const { token } = await ctx.params;
    const hash = createHash("sha256").update(token).digest("hex");
    const db = createAdminClient();
    const { data, error } = await db
      .from("qr_tokens")
      .select(
        "valid_from,expires_at,revoked_at,visit:visits!qr_tokens_visit_id_fkey(id,status,starts_at,ends_at,purpose,visitor:visitors(full_name),host:profiles!visits_host_id_fkey(full_name),location:locations(name))",
      )
      .eq("token_hash", hash)
      .single();
    if (error || !data)
      return NextResponse.json(
        { error: "Pase no disponible" },
        { status: 404 },
      );
    const visit = data.visit as unknown as {
      id: string;
      status: string;
      starts_at: string;
      ends_at: string;
      purpose: string;
      visitor: { full_name?: string } | null;
      host: { full_name?: string } | null;
      location: { name?: string } | null;
    };
    const state =
      data.revoked_at || visit.status === "cancelled"
        ? "revoked"
        : new Date(data.expires_at) < new Date()
          ? "expired"
          : visit.status === "checked_out"
            ? "used"
            : "valid";
    return NextResponse.json(
      {
        visitId: visit.id,
        state,
        status: visit.status,
        visitorName: visit.visitor?.full_name ?? "Visitante",
        hostName: visit.host?.full_name ?? "Anfitrión",
        location: visit.location?.name ?? "Ubicación",
        startsAt: visit.starts_at,
        endsAt: visit.ends_at,
        purpose: visit.purpose,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json({ error: "Pase no disponible" }, { status: 404 });
  }
}
