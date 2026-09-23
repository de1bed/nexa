import { NextResponse } from "next/server";
import { z } from "zod";
import { normalizeAccessKey } from "@/lib/access-key";
import { createAdminClient } from "@/lib/server/supabase-admin";

export const dynamic = "force-dynamic";

const schema = z.object({ key: z.string().trim().min(4).max(40) });

/** Confirma la clave antes de abrir una cuenta. No crea usuarios ni empresas. */
export async function POST(request: Request) {
  try {
    const input = schema.parse(await request.json());
    const admin = createAdminClient();
    const { data: org, error } = await admin
      .from("organizations")
      .select("id,name,service_status,archived_at")
      .eq("access_key", normalizeAccessKey(input.key))
      .maybeSingle();
    if (error) throw error;
    if (!org || org.service_status !== "active" || org.archived_at) {
      return NextResponse.json(
        { error: "Esa clave no corresponde a una empresa activa." },
        { status: 400 },
      );
    }

    const { data: departments } = await admin
      .from("departments")
      .select("id,name")
      .eq("organization_id", org.id)
      .eq("active", true)
      .order("name");

    return NextResponse.json({
      organizationName: org.name,
      departments: departments ?? [],
    });
  } catch {
    return NextResponse.json({ error: "Clave inválida" }, { status: 400 });
  }
}
