import { NextResponse } from "next/server";
import { z } from "zod";
import { normalizeAccessKey } from "@/lib/access-key";
import { getSessionContext } from "@/lib/server/session";

export const dynamic = "force-dynamic";

const schema = z.object({ key: z.string().trim().min(4).max(40) });

export async function POST(request: Request) {
  const context = await getSessionContext();
  if (!context.user)
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  try {
    const input = schema.parse(await request.json());
    const { data, error } = await context.db.rpc("preview_access_key", {
      p_key: normalizeAccessKey(input.key),
    });
    if (error) throw error;
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Clave inválida" }, { status: 400 });
  }
}
