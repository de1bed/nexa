import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/server/supabase-admin";

export const dynamic = "force-dynamic";

const schema = z.object({ email: z.email() });

/** Dice si el correo ya tiene cuenta, para no repetir el registro. */
export async function POST(request: Request) {
  try {
    const input = schema.parse(await request.json());
    const email = input.email.trim().toLowerCase();
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("profiles")
      .select("id")
      .ilike("email", email)
      .maybeSingle();
    if (error) throw error;
    return NextResponse.json({ exists: Boolean(data) });
  } catch {
    return NextResponse.json({ error: "No fue posible revisar el correo" }, { status: 400 });
  }
}
