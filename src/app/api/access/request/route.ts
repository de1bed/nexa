import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** La clave de empresa ya no abre una cuenta. Solo entra quien recibe invitación. */
export async function POST() {
  return NextResponse.json(
    { error: "El acceso es solo por invitación." },
    { status: 403 },
  );
}
