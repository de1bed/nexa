import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Un código ya no mete a nadie en una empresa. */
export async function POST() {
  return NextResponse.json(
    { error: "El acceso es solo por invitación." },
    { status: 403 },
  );
}
