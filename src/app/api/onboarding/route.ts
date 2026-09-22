import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** El alta abierta de empresas quedó cerrada. La consola de plataforma crea la empresa y entrega la clave. */
export async function POST() {
  return NextResponse.json(
    {
      error:
        "Una empresa nueva se activa con la clave que entrega NEXA. Si ya tienes clave, entra a tu cuenta y solicítala.",
    },
    { status: 403 },
  );
}
