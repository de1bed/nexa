import type {
  AccessEvent,
  Location,
  OrganizationSettings,
  TeamMember,
  Visit,
  VisitStatus,
  WorkspaceState,
} from "./domain";

/**
 * Datos de vitrina: permiten recorrer los cuatro portales sin credenciales.
 * Replican la forma exacta que devuelven las APIs contra Supabase, de modo que
 * la interfaz no distingue entre un modo y el otro.
 */

export const showcaseOrganization = {
  id: "org-nova",
  name: "Nova Logistics",
};

export const showcaseLocations: Location[] = [
  {
    id: "loc-tijuana",
    name: "Centro de Distribución Tijuana",
    address: "Blvd. Industrial 2400, Tijuana, B.C.",
    timezone: "America/Tijuana",
    active: true,
  },
  {
    id: "loc-corporativo",
    name: "Corporativo Insurgentes",
    address: "Av. Insurgentes Sur 1602, CDMX",
    timezone: "America/Mexico_City",
    active: true,
  },
];

export const showcaseTeam: TeamMember[] = [
  {
    id: "demo-admin",
    name: "Elena Torres",
    email: "admin@novalogistics.demo",
    role: "admin",
    active: true,
  },
  {
    id: "host-mateo",
    name: "Mateo García",
    email: "mateo@novalogistics.demo",
    role: "host",
    active: true,
  },
  {
    id: "host-valeria",
    name: "Valeria Cruz",
    email: "valeria@novalogistics.demo",
    role: "host",
    active: true,
  },
  {
    id: "demo-guard",
    name: "Carlos Mendoza",
    email: "guardia1@novalogistics.demo",
    role: "guard",
    active: true,
  },
  {
    id: "guard-lucia",
    name: "Lucía Herrera",
    email: "guardia2@novalogistics.demo",
    role: "guard",
    active: true,
  },
];

export const showcaseSettings: OrganizationSettings = {
  documentRetentionDays: 30,
  allowDocumentPreviewForGuards: false,
  earlyEntryMinutes: 15,
  lateEntryMinutes: 30,
  privacyNotice:
    "Los datos personales que proporcionas se utilizan únicamente para gestionar, controlar y auditar tu acceso a nuestras instalaciones. Tu identificación se conserva de forma privada durante el periodo de retención configurado y después se elimina de manera permanente. No realizamos reconocimiento facial ni almacenamos datos biométricos.",
  privacyNoticeVersion: "mvp-1",
};

const names = [
  "Sofía Rivera",
  "Diego Luna",
  "Camila Ortega",
  "Andrés Vega",
  "Renata Silva",
  "Javier Campos",
  "Mariana Ríos",
  "Emilio Navarro",
  "Paula Castillo",
  "Nicolás Serrano",
];
const companies = [
  "Arco Studio",
  "Lumen Tech",
  "Órbita Legal",
  "Punto Norte",
  "Atlas Supply",
];
const purposes = [
  "Reunión comercial",
  "Entrega de proveedor",
  "Entrevista",
  "Auditoría",
  "Soporte técnico",
];
const statuses: VisitStatus[] = [
  "invited",
  "pre_registered",
  "checked_in",
  "checked_out",
  "invited",
  "denied",
];

function at(dayOffset: number, hour: number, minute = 0) {
  const date = new Date();
  date.setHours(hour, minute, 0, 0);
  date.setDate(date.getDate() + dayOffset);
  return date.toISOString();
}

export const showcaseVisits: Visit[] = Array.from({ length: 26 }, (_, index) => {
  const number = index + 1;
  const status = statuses[index % statuses.length];
  const hour = 8 + (index % 9);
  const offset = (index % 9) - 4;
  const host = index % 2 ? showcaseTeam[1] : showcaseTeam[2];
  const location = showcaseLocations[index % 2];
  const inside = status === "checked_in";
  const finished = status === "checked_out";

  return {
    id: `visit-${number}`,
    visitorName: names[index % names.length],
    email: `visitante${number}@example.test`,
    phone: `664 000 ${String(number).padStart(4, "0")}`,
    company: companies[index % companies.length],
    hostId: host.id,
    hostName: host.name,
    hostEmail: host.email,
    locationId: location.id,
    location: location.name,
    locationAddress: location.address,
    startsAt: at(offset, hour),
    endsAt: at(offset, hour + 1),
    checkedInAt: inside
      ? at(0, Math.max(7, new Date().getHours() - (index % 3) - 1), 20)
      : finished
        ? at(offset, hour, 10)
        : undefined,
    checkedOutAt: finished ? at(offset, hour + 1, 5) : undefined,
    purpose: purposes[index % purposes.length],
    status: inside ? "checked_in" : status,
    origin: "host_invitation",
    documentCaptured: status !== "invited",
    documentType: status !== "invited" ? "INE / IFE" : undefined,
    documentMasked: status !== "invited" ? "•••• 4829" : undefined,
    consentedAt: status !== "invited" ? at(offset - 1, 12) : undefined,
    denialReason:
      status === "denied" ? "Identificación no presentada" : undefined,
    invitationToken:
      number === 1 ? "nexa-demo-invitation-2026" : `invite-${number}`,
    qrToken:
      status === "invited"
        ? undefined
        : number === 3
          ? "nexa-demo-pass-2026"
          : `pass-${number}`,
    inviteeName: names[index % names.length],
    inviteeEmail: `visitante${number}@example.test`,
    inviteeCompany: companies[index % companies.length],
    vehiclePlate: index % 4 === 0 ? "ABC-1234" : undefined,
  } satisfies Visit;
});

const showcaseEvents: AccessEvent[] = showcaseVisits
  .filter((visit) => visit.status !== "invited")
  .slice(0, 14)
  .map((visit, index) => ({
    id: `event-${index}`,
    visitId: visit.id,
    type:
      visit.status === "checked_out"
        ? "check_out"
        : visit.status === "checked_in"
          ? "check_in"
          : visit.status === "denied"
            ? "denied"
            : "pre_registered",
    at: visit.checkedInAt ?? visit.startsAt,
    actor: visit.status === "invited" ? visit.hostName : "Carlos Mendoza",
    detail: visit.denialReason,
  }));

export const initialShowcaseState: WorkspaceState = {
  visits: showcaseVisits,
  events: showcaseEvents,
};
