import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Booth, BoothKind } from "@/lib/domain";
import { resolveRecordingBooth } from "@/lib/booth-choice";

const boothColumns = "id,location_id,name,notes,active,kind";
const legacyBoothColumns = "id,location_id,name,notes,active";

function isBoothKind(value: unknown): value is BoothKind {
  return value === "general" || value === "pedestrian" || value === "vehicle";
}

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
  kind?: string | null;
}): Booth {
  return {
    id: row.id,
    locationId: row.location_id,
    name: row.name,
    notes: row.notes ?? "",
    active: row.active,
    kind: isBoothKind(row.kind) ? row.kind : "general",
  };
}

type BoothRow = {
  id: string;
  location_id: string;
  name: string;
  notes?: string | null;
  active: boolean;
  kind?: string | null;
};

/** Lee las casetas. Si la migración del tipo aún no está, omite kind. */
export async function listBooths(
  db: SupabaseClient,
  organizationId: string,
  activeOnly = false,
): Promise<{ data: BoothRow[] | null; error: { message?: string } | null }> {
  const run = async (columns: string) => {
    let query = db
      .from("booths")
      .select(columns)
      .eq("organization_id", organizationId);
    if (activeOnly) query = query.eq("active", true);
    return query.order("name");
  };

  const first = await run(boothColumns);
  const chosen =
    first.error && /kind/i.test(first.error.message ?? "")
      ? await run(legacyBoothColumns)
      : first;
  return {
    data: (chosen.data ?? null) as BoothRow[] | null,
    error: chosen.error,
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
  const { data, error } = await listBooths(db, input.organizationId, true);
  if (error) return { id: input.boothId ?? null, name: null };

  const booth = resolveRecordingBooth({
    booths: (data ?? []).map((row) => mapBooth(row)),
    boothId: input.boothId ?? undefined,
    locationId: input.locationId,
    decision: input.decision,
  });
  return { id: booth?.id ?? null, name: booth?.name ?? null };
}
