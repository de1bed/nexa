import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { requireApiContext } from "@/lib/server/session";
import { createAdminClient } from "@/lib/server/supabase-admin";
import { writeAudit } from "@/lib/server/audit";
import { LOGO_BUCKET, logoPublicUrl } from "@/lib/server/walkin";

export const dynamic = "force-dynamic";

const MAX_LOGO_BYTES = 2 * 1024 * 1024;
const LOGO_TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

/**
 * Logo de la empresa para la hoja imprimible. El bucket es de lectura pública
 * y sin SVG. `organizations` no admite UPDATE desde la sesión del usuario, así
 * que la escritura va con service role después de validar el rol.
 */
export async function POST(request: Request) {
  const guard = await requireApiContext(["superadmin", "admin"]);
  if (!guard.ok)
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  const { organizationId, userId } = guard.context;

  const form = await request.formData();
  const file = form.get("logo");
  if (!(file instanceof File) || file.size === 0)
    return NextResponse.json({ error: "Elige una imagen" }, { status: 400 });
  const extension = LOGO_TYPES[file.type.toLowerCase()];
  if (!extension)
    return NextResponse.json(
      { error: "El logo debe ser PNG, JPG o WebP" },
      { status: 400 },
    );
  if (file.size > MAX_LOGO_BYTES)
    return NextResponse.json(
      { error: "El logo debe pesar menos de 2 MB" },
      { status: 400 },
    );

  const admin = createAdminClient();
  const { data: organization } = await admin
    .from("organizations")
    .select("logo_path")
    .eq("id", organizationId)
    .maybeSingle();

  const path = `${organizationId}/logo-${randomUUID()}.${extension}`;
  const { error: uploadError } = await admin.storage
    .from(LOGO_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });
  if (uploadError) {
    console.error("Logo upload failed", uploadError);
    return NextResponse.json(
      { error: "No fue posible subir el logo" },
      { status: 500 },
    );
  }

  const { error } = await admin
    .from("organizations")
    .update({ logo_path: path })
    .eq("id", organizationId);
  if (error) {
    await admin.storage.from(LOGO_BUCKET).remove([path]);
    return NextResponse.json(
      { error: "No fue posible guardar el logo" },
      { status: 500 },
    );
  }

  const previous = organization?.logo_path as string | null;
  if (previous) await admin.storage.from(LOGO_BUCKET).remove([previous]);

  await writeAudit({
    organizationId,
    actorId: userId,
    eventType: "logo_updated",
  });

  return NextResponse.json({ logoUrl: logoPublicUrl(path) });
}

export async function DELETE() {
  const guard = await requireApiContext(["superadmin", "admin"]);
  if (!guard.ok)
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  const { organizationId, userId } = guard.context;

  const admin = createAdminClient();
  const { data: organization } = await admin
    .from("organizations")
    .select("logo_path")
    .eq("id", organizationId)
    .maybeSingle();

  await admin
    .from("organizations")
    .update({ logo_path: null })
    .eq("id", organizationId);
  const previous = organization?.logo_path as string | null;
  if (previous) await admin.storage.from(LOGO_BUCKET).remove([previous]);

  await writeAudit({
    organizationId,
    actorId: userId,
    eventType: "logo_removed",
  });

  return NextResponse.json({ ok: true });
}
