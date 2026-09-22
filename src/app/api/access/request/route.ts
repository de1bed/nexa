import { NextResponse } from "next/server";
import { z } from "zod";
import { normalizeAccessKey } from "@/lib/access-key";
import { getSessionContext } from "@/lib/server/session";

export const dynamic = "force-dynamic";

const schema = z.object({
  key: z.string().trim().min(4).max(40),
  role: z.enum(["admin", "host", "guard"]),
  departmentId: z.uuid().nullable().optional(),
});

export async function POST(request: Request) {
  const context = await getSessionContext();
  if (!context.user)
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  try {
    const input = schema.parse(await request.json());
    const { data, error } = await context.db.rpc("submit_access_request", {
      p_key: normalizeAccessKey(input.key),
      p_role: input.role,
      p_department: input.departmentId ?? null,
    });
    if (error) throw error;
    const result = data as { state?: string };
    if (result?.state === "invalid" || result?.state === "invalid_role")
      return NextResponse.json(
        { error: "Esa clave no corresponde a una empresa activa." },
        { status: 400 },
      );
    if (result?.state === "invalid_department")
      return NextResponse.json(
        { error: "Elige un área de esa empresa." },
        { status: 400 },
      );
    if (result?.state === "department_required")
      return NextResponse.json(
        { error: "Esta empresa pide que indiques tu área." },
        { status: 400 },
      );
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof z.ZodError)
      return NextResponse.json({ error: "Revisa la clave y el rol." }, { status: 400 });
    return NextResponse.json(
      { error: "No fue posible enviar la solicitud." },
      { status: 500 },
    );
  }
}
