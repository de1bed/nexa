import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  parseSafetyDocuments,
  type SafetyDocument,
} from "@/lib/safety-documents";

export async function loadSafetyDocuments(
  db: SupabaseClient,
  organizationId: string,
): Promise<SafetyDocument[]> {
  const { data, error } = await db
    .from("organization_settings")
    .select("safety_documents")
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (error || !data) return [];
  return parseSafetyDocuments(
    (data as { safety_documents?: unknown }).safety_documents,
  );
}

export function missingSafetyColumn(error: { message?: string } | null) {
  return /safety_documents/i.test(error?.message ?? "");
}
