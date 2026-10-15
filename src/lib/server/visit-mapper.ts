import "server-only";
import type { AccessEvent, AccessEventType, Visit } from "@/lib/domain";
import { documentFlags } from "@/lib/visitor-flow";

/**
 * Proyección única de `visits` hacia el contrato de dominio.
 * `visit_access_locations` crea una segunda relación visits↔locations, por eso
 * la sede principal se pide con el nombre de su llave foránea.
 * Cualquier ruta que devuelva visitas usa este select y este mapeo, de modo que
 * el cliente recibe siempre la misma forma.
 */
export const visitSelect =
  "id,organization_id,location_id,host_id,status,origin,purpose,visitor_company," +
  "starts_at,ends_at,pass_valid_days,checked_in_at,checked_out_at,denial_reason,vehicle_plate," +
  "vehicle_declined,all_locations," +
  "internal_notes,visitor_notes,access_requirements,internal_place,meeting_url,consented_at," +
  "check_in_booth_id,check_out_booth_id," +
  "visitor:visitors(full_name,email,phone,company,document_type,document_number_masked)," +
  "host:profiles!visits_host_id_fkey(full_name,email)," +
  "location:locations!visits_location_id_fkey(name,address)," +
  "check_in_booth:booths!visits_check_in_booth_id_fkey(name,location:locations!booths_location_id_fkey(name))," +
  "check_out_booth:booths!visits_check_out_booth_id_fkey(name,location:locations!booths_location_id_fkey(name))," +
  "documents:visitor_documents(id,deleted_at,document_type)," +
  "invitation:visit_invitations(invitee_name,invitee_email,invitee_phone,invitee_company,completed_at,revoked_at)," +
  "access:visit_access_locations(location_id,location:locations(name))," +
  "decisions:access_events(event_type,occurred_at,booth_id,metadata," +
  "actor:profiles!access_events_actor_id_fkey(full_name)," +
  "booth:booths!access_events_booth_id_fkey(name))";

export const eventSelect =
  "id,visit_id,event_type,occurred_at,reason,metadata," +
  "actor:profiles!access_events_actor_id_fkey(full_name)," +
  "booth:booths!access_events_booth_id_fkey(name)";

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
  const checkInBooth = pick<{ name?: string; location?: unknown }>(row.check_in_booth);
  const checkOutBooth = pick<{ name?: string; location?: unknown }>(row.check_out_booth);
  const checkInSite = pick<{ name?: string }>(checkInBooth?.location);
  const checkOutSite = pick<{ name?: string }>(checkOutBooth?.location);
  const invitation = pick<{
    invitee_name?: string;
    invitee_email?: string;
    invitee_phone?: string;
    invitee_company?: string;
  }>(row.invitation);
  const documents = Array.isArray(row.documents)
    ? (row.documents as Array<{
        deleted_at?: string | null;
        document_type?: string | null;
      }>)
    : [];
  const access = Array.isArray(row.access)
    ? (row.access as Array<{ location_id?: string; location?: unknown }>)
        .map((item) => ({
          id: String(item.location_id ?? ""),
          name: pick<{ name?: string }>(item.location)?.name ?? "",
        }))
        .filter((item) => item.id)
        .sort((a, b) => a.name.localeCompare(b.name, "es"))
    : [];
  const gates = Array.isArray(row.decisions)
    ? (row.decisions as Gate[])
    : [];
  const entry = latestGate(gates, ["check_in", "manual_check_in"]);
  const exit = latestGate(gates, ["check_out"]);
  const denial = latestGate(gates, ["denied"]);
  const entrySnap = gateBooth(entry);
  const exitSnap = gateBooth(exit);
  const denialSnap = gateBooth(denial);
  const flags = documentFlags(
    documents
      .filter((document) => !document.deleted_at)
      .map((document) => document.document_type),
  );

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
    passValidDays: Number(row.pass_valid_days ?? 1),
    checkedInAt: (row.checked_in_at as string) ?? undefined,
    checkedOutAt: (row.checked_out_at as string) ?? undefined,
    checkInBoothId:
      (row.check_in_booth_id as string) || entrySnap.id || undefined,
    checkInBooth: entrySnap.name || checkInBooth?.name || undefined,
    checkInSite: checkInSite?.name ?? undefined,
    checkInBy: gateActor(entry),
    checkOutBoothId:
      (row.check_out_booth_id as string) || exitSnap.id || undefined,
    checkOutBooth: exitSnap.name || checkOutBooth?.name || undefined,
    checkOutSite: checkOutSite?.name ?? undefined,
    checkOutBy: gateActor(exit),
    denialBoothId: denialSnap.id,
    denialBooth: denialSnap.name,
    deniedBy: gateActor(denial),
    purpose: String(row.purpose ?? ""),
    status: row.status as Visit["status"],
    origin: row.origin as Visit["origin"],
    notes: (row.internal_notes as string) ?? undefined,
    visitorNotes: (row.visitor_notes as string) ?? undefined,
    accessRequirements: (row.access_requirements as string) ?? undefined,
    internalPlace: (row.internal_place as string) ?? undefined,
    meetingUrl: (row.meeting_url as string) ?? undefined,
    vehiclePlate: (row.vehicle_plate as string) ?? undefined,
    vehicleDeclined: Boolean(row.vehicle_declined),
    allLocations: row.all_locations !== false,
    accessLocationIds: access.map((item) => item.id),
    accessLocationNames: access.map((item) => item.name),
    documentType: visitor?.document_type ?? undefined,
    documentMasked: visitor?.document_number_masked ?? undefined,
    ...flags,
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

type Gate = {
  event_type?: string;
  occurred_at?: string;
  booth_id?: string | null;
  metadata?: { booth_name?: string; actor_name?: string } | null;
  actor?: unknown;
  booth?: unknown;
};

function latestGate(gates: Gate[], types: string[]): Gate | undefined {
  return gates
    .filter((gate) => types.includes(String(gate.event_type)))
    .sort((a, b) => String(b.occurred_at).localeCompare(String(a.occurred_at)))[0];
}

/** El nombre guardado en el evento gana sobre el nombre actual de la caseta. */
function gateBooth(gate?: Gate): { id?: string; name?: string } {
  if (!gate) return {};
  const joined = pick<{ name?: string }>(gate.booth)?.name;
  const name = gate.metadata?.booth_name || joined;
  return {
    id: gate.booth_id || undefined,
    name: name || undefined,
  };
}

function gateActor(gate?: Gate): string | undefined {
  if (!gate) return undefined;
  const joined = pick<{ full_name?: string }>(gate.actor)?.full_name;
  return gate.metadata?.actor_name || joined || undefined;
}

export function mapEvent(row: Row): AccessEvent {
  const actor = pick<{ full_name?: string }>(row.actor);
  const booth = pick<{ name?: string }>(row.booth);
  const metadata = (row.metadata ?? {}) as {
    booth_name?: string;
    actor_name?: string;
  };
  return {
    id: String(row.id),
    visitId: String(row.visit_id),
    type: eventTypeMap[String(row.event_type)] ?? "qr_scanned",
    at: String(row.occurred_at),
    actor: metadata.actor_name || actor?.full_name || "Sistema",
    detail: (row.reason as string) ?? undefined,
    booth: metadata.booth_name || booth?.name || undefined,
  };
}
