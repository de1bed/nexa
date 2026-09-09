import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** La lectura automática está apagada: el visitante escribe sus datos. */
export async function POST() {
  return NextResponse.json(
    { error: "La lectura automática está desactivada" },
    { status: 410 },
  );
}
