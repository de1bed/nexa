import type { Visit, VisitStatus, WorkspaceState } from "./domain";
import { accessWindow } from "./domain";

/**
 * Reglas de acceso puras. Son la referencia de comportamiento del modo vitrina
 * y el espejo verificable de `record_access_decision` en PostgreSQL: cualquier
 * cambio en una debe reflejarse en la otra.
 */

export type ServiceResult<T> =
  | { ok: true; value: T }
  | { ok: false; code: string };

export type AccessOptions = {
  earlyMinutes?: number;
  lateMinutes?: number;
};

const closedStatuses: VisitStatus[] = [
  "checked_out",
  "cancelled",
  "expired",
  "denied",
];

export function resolveInvitation(
  state: WorkspaceState,
  token: string,
  now = new Date(),
): ServiceResult<Visit> {
  const visit = state.visits.find((item) => item.invitationToken === token);
  if (!visit) return { ok: false, code: "invalid" };
  if (visit.status === "cancelled") return { ok: false, code: "cancelled" };
  if (new Date(visit.endsAt).getTime() + 86400000 < now.getTime())
    return { ok: false, code: "expired" };
  return { ok: true, value: visit };
}

export function resolveQr(
  state: WorkspaceState,
  token: string,
  now = new Date(),
  options: AccessOptions = {},
): ServiceResult<{ visit: Visit; window: "valid" | "outside" }> {
  const visit = state.visits.find((item) => item.qrToken === token);
  if (!visit) return { ok: false, code: "invalid" };
  if (closedStatuses.includes(visit.status) && visit.status !== "checked_out")
    return { ok: false, code: visit.status };
  const window = accessWindow(visit, { ...options, now });
  return {
    ok: true,
    value: { visit, window: window === "valid" ? "valid" : "outside" },
  };
}

export function checkIn(
  visit: Visit,
  at = new Date(),
  allowOutside = false,
  options: AccessOptions = {},
): ServiceResult<Visit> {
  if (visit.status === "checked_in")
    return { ok: false, code: "duplicate_check_in" };
  if (closedStatuses.includes(visit.status))
    return { ok: false, code: "invalid_status" };
  if (accessWindow(visit, { ...options, now: at }) !== "valid" && !allowOutside)
    return { ok: false, code: "outside_window" };
  return {
    ok: true,
    value: { ...visit, status: "checked_in", checkedInAt: at.toISOString() },
  };
}

export function checkOut(visit: Visit, at = new Date()): ServiceResult<Visit> {
  if (visit.status === "checked_out")
    return { ok: false, code: "duplicate_check_out" };
  if (visit.status !== "checked_in")
    return { ok: false, code: "not_checked_in" };
  return {
    ok: true,
    value: {
      ...visit,
      status: "checked_out",
      checkedOutAt: at.toISOString(),
      qrToken: undefined,
    },
  };
}

export function deny(
  visit: Visit,
  reason: string,
  at = new Date(),
): ServiceResult<Visit> {
  if (!reason.trim()) return { ok: false, code: "reason_required" };
  if (visit.status === "checked_out" || visit.status === "cancelled")
    return { ok: false, code: "invalid_status" };
  return {
    ok: true,
    value: {
      ...visit,
      status: "denied",
      denialReason: reason,
      qrToken: undefined,
      checkedOutAt: visit.checkedInAt ? at.toISOString() : undefined,
    },
  };
}

export function revokeQr(visit: Visit): Visit {
  return { ...visit, qrToken: undefined };
}

export function createManualVisit(
  input: Pick<
    Visit,
    | "visitorName"
    | "email"
    | "company"
    | "hostName"
    | "hostId"
    | "location"
    | "purpose"
  > &
    Partial<Pick<Visit, "phone" | "locationId" | "documentCaptured">>,
  at = new Date(),
): Visit {
  return {
    ...input,
    id: crypto.randomUUID(),
    startsAt: at.toISOString(),
    endsAt: new Date(at.getTime() + 3600000).toISOString(),
    checkedInAt: at.toISOString(),
    status: "checked_in",
    origin: "guard_manual",
    documentCaptured: input.documentCaptured ?? false,
    consentedAt: at.toISOString(),
  };
}

export function expiredDocumentIds(
  documents: Array<{
    id: string;
    retentionExpiresAt: string;
    deletedAt?: string;
  }>,
  now = new Date(),
) {
  return documents
    .filter(
      (document) =>
        !document.deletedAt && new Date(document.retentionExpiresAt) <= now,
    )
    .map((document) => document.id);
}

/** Visitas que deben marcarse vencidas porque nadie llegó. */
export function staleVisitIds(visits: Visit[], now = new Date()) {
  const cutoff = now.getTime() - 12 * 3600000;
  return visits
    .filter(
      (visit) =>
        ["invited", "pre_registered", "approved"].includes(visit.status) &&
        new Date(visit.endsAt).getTime() < cutoff,
    )
    .map((visit) => visit.id);
}
