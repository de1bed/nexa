import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiContext } from "@/lib/server/session";
import { writeAudit } from "@/lib/server/audit";
import {
  loadSafetyDocuments,
  missingSafetyColumn,
} from "@/lib/server/safety-documents";

export const dynamic = "force-dynamic";

const documentSchema = z.object({
  id: z.uuid(),
  title: z.string().trim().min(2).max(120),
  body: z.string().trim().max(2000).default(""),
  url: z
    .string()
    .trim()
    .max(500)
    .default("")
    .refine((value) => value === "" || /^https:\/\//i.test(value), {
      message: "El enlace debe empezar con https://",
    }),
});

const replaceSchema = z.object({
  documents: z.array(documentSchema).max(20),
});

export async function GET() {
  const guard = await requireApiContext(["superadmin", "admin"]);
  if (!guard.ok)
    return NextResponse.json({ error: guard.error }, { status: guard.status });

  const documents = await loadSafetyDocuments(
    guard.context.db,
    guard.context.organizationId,
  );
  return NextResponse.json(
    { documents },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function PUT(request: Request) {
  const guard = await requireApiContext(["superadmin", "admin"]);
  if (!guard.ok)
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  const { db, organizationId, userId } = guard.context;

  try {
    const input = replaceSchema.parse(await request.json());
    const { data: saved, error } = await db
      .from("organization_settings")
      .update({ safety_documents: input.documents })
      .eq("organization_id", organizationId)
      .select("organization_id");
    if (error && missingSafetyColumn(error))
      return NextResponse.json(
        {
          error:
            "Falta aplicar la migración de documentos de seguridad antes de guardarlos.",
        },
        { status: 503 },
      );
    if (error) throw error;
    if (!saved?.length)
      return NextResponse.json(
        { error: "Guarda primero la configuración de la empresa." },
        { status: 409 },
      );

    await writeAudit({
      organizationId,
      actorId: userId,
      eventType: "settings_modified",
      metadata: {
        safety_documents: input.documents.map((item) => item.id),
      },
    });
    return NextResponse.json({ documents: input.documents });
  } catch (error) {
    if (error instanceof z.ZodError)
      return NextResponse.json(
        { error: error.issues[0]?.message ?? "Datos inválidos" },
        { status: 400 },
      );
    return NextResponse.json(
      { error: "No fue posible guardar los documentos" },
      { status: 500 },
    );
  }
}
