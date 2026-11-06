import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Bucket privado: se entrega siempre con URL firmada. */
export const SECURITY_BUCKET = "security-documents";
export const MAX_SECURITY_BYTES = 10 * 1024 * 1024;
export const SECURITY_TYPES: Record<string, string> = {
  "application/pdf": "pdf",
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

export type SecurityDocument = {
  id: string;
  title: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
};

/** Si la migración 0040 aún no se aplica, la función sigue sin documentos. */
export function missingSecuritySchema(error: { code?: string; message?: string } | null) {
  if (!error) return false;
  return (
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    /organization_security_documents|visit_security_acceptances/.test(error.message ?? "")
  );
}

export async function listSecurityDocuments(
  db: SupabaseClient,
  organizationId: string,
): Promise<SecurityDocument[]> {
  const { data, error } = await db
    .from("organization_security_documents")
    .select("id,title,mime_type,size_bytes,created_at")
    .eq("organization_id", organizationId)
    .eq("active", true)
    .order("created_at");
  if (error) {
    if (!missingSecuritySchema(error)) console.error("Security documents read failed", error);
    return [];
  }
  return (data ?? []).map((row) => ({
    id: row.id as string,
    title: row.title as string,
    mimeType: row.mime_type as string,
    sizeBytes: Number(row.size_bytes ?? 0),
    createdAt: row.created_at as string,
  }));
}

export async function signedSecurityUrl(db: SupabaseClient, path: string) {
  const { data, error } = await db.storage
    .from(SECURITY_BUCKET)
    .createSignedUrl(path, 300);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

export type SecurityAcceptance = {
  acceptedAt?: string;
  titles: string[];
  pending: number;
};

/** Constancia por visita: qué aceptó y cuándo. Para la ficha, la caseta y el Excel. */
export async function securityAcceptancesByVisit(
  db: SupabaseClient,
  organizationId: string,
) {
  const byVisit = new Map<string, SecurityAcceptance>();
  const { data, error } = await db
    .from("visit_security_acceptances")
    .select("visit_id,document_title,accepted_at")
    .eq("organization_id", organizationId)
    .limit(5000);
  if (error) return byVisit;
  for (const row of data ?? []) {
    const visitId = row.visit_id as string;
    const current = byVisit.get(visitId) ?? { titles: [], pending: 0 };
    const acceptedAt = row.accepted_at as string | null;
    if (acceptedAt) {
      current.titles.push(row.document_title as string);
      if (!current.acceptedAt || acceptedAt > current.acceptedAt)
        current.acceptedAt = acceptedAt;
    } else {
      current.pending += 1;
    }
    byVisit.set(visitId, current);
  }
  return byVisit;
}
