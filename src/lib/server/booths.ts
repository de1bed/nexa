import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Booth } from "@/lib/domain";
import { resolveRecordingBooth } from "@/lib/booth-choice";

/** La instalación todavía no tiene la migración de casetas. */
export function missingBoothSchema(
  error: { message?: string; details?: string; hint?: string } | null,
): boolean {
  if (!error) return false;
  const text = `${error.message ?? ""} ${error.details ?? ""} ${error.hint ?? ""}`;
  return /booth/i.test(text);
}

export function mapBooth(row: {
  id: string;
  location_id: string;
  name: string;
  notes?: string | null;
  active: boolean;
}): Booth {
  return {
    id: row.id,
    locationId: row.location_id,
    name: row.name,
    notes: row.notes ?? "",
    active: row.active,
  };
}

/**
 * Resuelve la caseta en el servidor. Si la tabla todavía no existe, el acceso
 * se registra como antes, sin caseta, para no romper instalaciones sin migrar.
 */
export async function resolveAccessBooth(
  db: SupabaseClient,
  input: {
    organizationId: string;
    locationId: string;
    boothId?: string | null;
    decision: "check_in" | "check_out" | "deny";
  },
): Promise<{ id: string | null; name: string | null }> {
  const { data, error } = await db
    .from("booths")
    .select("id,location_id,name,notes,active")
    .eq("organization_id", input.organizationId)
    .eq("active", true);
  if (error) return { id: input.boothId ?? null, name: null };

  const booth = resolveRecordingBooth({
    booths: (data ?? []).map((row) =>
      mapBooth(row as {
        id: string;
        location_id: string;
        name: string;
        notes?: string | null;
        active: boolean;
      }),
    ),
    boothId: input.boothId ?? undefined,
    locationId: input.locationId,
    decision: input.decision,
  });
  return { id: booth?.id ?? null, name: booth?.name ?? null };
}
