import "server-only";
import { createHash } from "node:crypto";
import { createAdminClient } from "./supabase-admin";
import { healQrWindow } from "./pass-issue";

/**
 * Resolución de un pase a partir de su token público.
 *
 * Es la consulta que comparten la vista del pase y las dos carteras. El token
 * viaja hasheado: en la base de datos solo vive su SHA-256.
 */

export type PassState = "valid" | "used" | "expired" | "revoked";

export type ResolvedPass = {
  visitId: string;
  state: PassState;
  status: string;
  organizationName: string;
  visitorName: string;
  hostName: string;
  location: string;
  locationAddress: string;
  startsAt: string;
  endsAt: string;
  checkedInAt: string | null;
  checkedOutAt: string | null;
  purpose: string;
  accessRequirements: string;
  validFrom: string;
  expiresAt: string;
};

type Row = {
  valid_from: string;
  expires_at: string;
  revoked_at: string | null;
  visit: {
    id: string;
    status: string;
    starts_at: string;
    ends_at: string;
    purpose: string;
    checked_in_at: string | null;
    checked_out_at: string | null;
    access_requirements: string | null;
    organization: { name?: string } | null;
    visitor: { full_name?: string } | null;
    host: { full_name?: string } | null;
    location: { name?: string; address?: string } | null;
  } | null;
};

export async function resolvePassByToken(
  token: string,
): Promise<ResolvedPass | null> {
  const hash = createHash("sha256").update(token).digest("hex");

  const { data, error } = await createAdminClient()
    .from("qr_tokens")
    .select(
      "valid_from,expires_at,revoked_at," +
        "visit:visits!qr_tokens_visit_id_fkey(id,status,starts_at,ends_at,purpose,checked_in_at,checked_out_at,access_requirements," +
        "organization:organizations(name),visitor:visitors(full_name),host:profiles!visits_host_id_fkey(full_name),location:locations(name,address))",
    )
    .eq("token_hash", hash)
    .maybeSingle();

  if (error || !data) return null;

  const row = data as unknown as Row;
  const visit = row.visit;
  if (!visit) return null;

  let validFrom = row.valid_from;
  let expiresAt = row.expires_at;
  const open =
    !row.revoked_at &&
    visit.status !== "cancelled" &&
    visit.status !== "checked_out" &&
    visit.status !== "denied";
  if (open) {
    try {
      const healed = await healQrWindow({
        visitId: visit.id,
        startsAt: visit.starts_at,
        endsAt: visit.ends_at,
        validFrom,
        expiresAt,
      });
      validFrom = healed.validFrom;
      expiresAt = healed.expiresAt;
    } catch {
      // Si no se pudo alargar el pase, se muestra con la ventana que ya tenía.
    }
  }

  const state: PassState =
    row.revoked_at || visit.status === "cancelled"
      ? "revoked"
      : visit.status === "checked_out"
        ? "used"
        : new Date(expiresAt) < new Date()
          ? "expired"
          : "valid";

  return {
    visitId: visit.id,
    state,
    status: visit.status,
    organizationName: visit.organization?.name ?? "",
    visitorName: visit.visitor?.full_name ?? "Visitante",
    hostName: visit.host?.full_name ?? "Anfitrión",
    location: visit.location?.name ?? "Recepción",
    locationAddress: visit.location?.address ?? "",
    startsAt: visit.starts_at,
    endsAt: visit.ends_at,
    checkedInAt: visit.checked_in_at,
    checkedOutAt: visit.checked_out_at,
    purpose: visit.purpose,
    accessRequirements: visit.access_requirements ?? "",
    validFrom,
    expiresAt,
  };
}
