import "server-only";
import type { AccessEvent, AccessEventType, Visit } from "@/lib/domain";

/**
 * Proyección única de `visits` hacia el contrato de dominio.
 * Cualquier ruta que devuelva visitas usa este select y este mapeo, de modo que
 * el cliente recibe siempre la misma forma.
 */
export const visitSelect =
  "id,organization_id,location_id,host_id,status,origin,purpose,visitor_company," +
  "starts_at,ends_at,checked_in_at,checked_out_at,denial_reason,vehicle_plate," +
  "internal_notes,visitor_notes,access_requirements,consented_at," +
  "visitor:visitors(full_name,email,phone,company,document_type,document_number_masked)," +
  "host:profiles!visits_host_id_fkey(full_name,email)," +
  "location:locations(name,address)," +
  "documents:visitor_documents(id,deleted_at)," +
  "invitation:visit_invitations(invitee_name,invitee_email,invitee_phone,invitee_company,completed_at,revoked_at)";

export const eventSelect =
  "id,visit_id,event_type,occurred_at,reason," +
  "actor:profiles!access_events_actor_id_fkey(full_name)";

type Row = Record<string, unknown>;

function pick<T>(value: unknown): T | null {
  // PostgREST devuelve objeto o arreglo según la cardinalidad detectada.
  if (Array.isArray(value)) return (value[0] as T) ?? null;
  return (value as T) ?? null;
}

export function mapVisit(row: Row): Visit {
  const visitor = pick<{
    full_name?: string;
    email?: string;
    phone?: string;
    company?: string;
    document_type?: string;
    document_number_masked?: string;
  }>(row.visitor);
  const host = pick<{ full_name?: string; email?: string }>(row.host);
  const location = pick<{ name?: string; address?: string }>(row.location);
  const invitation = pick<{
    invitee_name?: string;
    invitee_email?: string;
    invitee_phone?: string;
    invitee_company?: string;
  }>(row.invitation);
  const documents = Array.isArray(row.documents)
    ? (row.documents as Array<{ deleted_at?: string | null }>)
    : [];

  return {
    id: String(row.id),
    visitorName: visitor?.full_name || invitation?.invitee_name || "Por confirmar",
    email: visitor?.email || invitation?.invitee_email || "",
    phone: visitor?.phone || invitation?.invitee_phone || undefined,
    company:
      String(row.visitor_company ?? "") ||
      visitor?.company ||
      invitation?.invitee_company ||
      "",
    hostId: String(row.host_id ?? ""),
    hostName: host?.full_name ?? "Anfitrión",
    hostEmail: host?.email ?? undefined,
    locationId: String(row.location_id ?? ""),
    location: location?.name ?? "Ubicación",
    locationAddress: location?.address ?? undefined,
    startsAt: String(row.starts_at),
    endsAt: String(row.ends_at),
    checkedInAt: (row.checked_in_at as string) ?? undefined,
    checkedOutAt: (row.checked_out_at as string) ?? undefined,
    purpose: String(row.purpose ?? ""),
    status: row.status as Visit["status"],
    origin: row.origin as Visit["origin"],
    notes: (row.internal_notes as string) ?? undefined,
    visitorNotes: (row.visitor_notes as string) ?? undefined,
    accessRequirements: (row.access_requirements as string) ?? undefined,
    vehiclePlate: (row.vehicle_plate as string) ?? undefined,
    documentType: visitor?.document_type ?? undefined,
    documentMasked: visitor?.document_number_masked ?? undefined,
    documentCaptured: documents.some((document) => !document.deleted_at),
    consentedAt: (row.consented_at as string) ?? undefined,
    denialReason: (row.denial_reason as string) ?? undefined,
    inviteeName: invitation?.invitee_name ?? undefined,
    inviteeEmail: invitation?.invitee_email ?? undefined,
    inviteePhone: invitation?.invitee_phone ?? undefined,
    inviteeCompany: invitation?.invitee_company ?? undefined,
  };
}

const eventTypeMap: Record<string, AccessEventType> = {
  qr_scanned: "qr_scanned",
  check_in: "check_in",
  check_out: "check_out",
  denied: "denied",
  manual_check_in: "check_in",
};

export function mapEvent(row: Row): AccessEvent {
  const actor = pick<{ full_name?: string }>(row.actor);
  return {
    id: String(row.id),
    visitId: String(row.visit_id),
    type: eventTypeMap[String(row.event_type)] ?? "qr_scanned",
    at: String(row.occurred_at),
    actor: actor?.full_name ?? "Sistema",
    detail: (row.reason as string) ?? undefined,
  };
}
