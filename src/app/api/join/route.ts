import { NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabase } from "@/lib/server/supabase";

export const dynamic = "force-dynamic";

const schema = z.object({
  code: z.string().min(6).max(12).transform((v) => v.toUpperCase().replace(/[^A-Z0-9]/g, "")),
});

export async function POST(request: Request) {
  const db = await createServerSupabase();
  const { data: { user } } = await db.auth.getUser();
  
  if (!user)
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  try {
    const input = schema.parse(await request.json());

    const { data, error } = await db.rpc("use_join_code", { p_code: input.code });

    if (error) {
      if (error.message.includes("inválido") || error.message.includes("expirado"))
        return NextResponse.json({ error: "Código inválido o expirado" }, { status: 400 });
      throw error;
    }

    const result = data?.[0];
    if (!result)
      return NextResponse.json({ error: "Código no encontrado" }, { status: 404 });

    return NextResponse.json({
      organizationId: result.organization_id,
      organizationName: result.organization_name,
      role: result.role,
      alreadyMember: result.already_member,
    });
  } catch (error) {
    if (error instanceof z.ZodError)
      return NextResponse.json({ error: "Código inválido" }, { status: 400 });
    console.error("Join code use failed", error);
    return NextResponse.json(
      { error: "No fue posible usar el código" },
      { status: 500 },
    );
  }
}
