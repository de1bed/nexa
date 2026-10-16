import type {
  AccessEvent,
  Booth,
  Location,
  OrganizationSettings,
  Requirement,
  TeamMember,
  Visit,
  VisitStatus,
  WorkspaceState,
} from "./domain";
import { defaultVisitorFlow } from "./visitor-flow";

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

export const showcaseBooths: Booth[] = [
  {
    id: "booth-tj-norte",
    locationId: "loc-tijuana",
    name: "Caseta Norte",
    notes: "Acceso de visitantes y personal de oficina.",
    active: true,
  },
  {
    id: "booth-tj-proveedores",
    locationId: "loc-tijuana",
    name: "Caseta de proveedores",
    notes: "Andén y entregas. Pide placas y fotos del vehículo.",
    active: true,
  },
  {
    id: "booth-cdmx-recepcion",
    locationId: "loc-corporativo",
    name: "Recepción principal",
    notes: "Lobby de Insurgentes.",
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
    status: "active",
    department: "Dirección",
  },
  {
    id: "host-mateo",
    name: "Mateo García",
    email: "mateo@novalogistics.demo",
    role: "host",
    active: true,
    status: "active",
    department: "Operaciones",
  },
  {
    id: "host-valeria",
    name: "Valeria Cruz",
    email: "valeria@novalogistics.demo",
    role: "host",
    active: true,
    status: "active",
    department: "Comercial",
  },
  {
    id: "demo-guard",
    name: "Carlos Mendoza",
    email: "guardia1@novalogistics.demo",
    role: "guard",
    active: true,
    status: "active",
    department: "Caseta",
    usesAccessCode: true,
    accessCode: "4821-9036",
    defaultLocationId: "loc-tijuana",
    defaultLocation: "Centro de Distribución Tijuana",
    defaultBoothId: "booth-tj-norte",
    defaultBooth: "Caseta Norte",
  },
  {
    id: "guard-lucia",
    name: "Lucía Herrera",
    email: "guardia2@novalogistics.demo",
    role: "guard",
    active: true,
    status: "active",
    department: "Caseta",
    usesAccessCode: true,
    accessCode: "7352-6410",
    defaultLocationId: "loc-tijuana",
    defaultLocation: "Centro de Distribución Tijuana",
    defaultBoothId: "booth-tj-proveedores",
    defaultBooth: "Caseta de proveedores",
  },
];

export const showcaseRequirements: Requirement[] = [
  {
    id: "req-imss",
    title: "Alta en IMSS vigente",
    description:
      "Para contratistas: foto del comprobante de alta del mes en curso.",
    askPhoto: true,
    askText: false,
    required: false,
    applyByDefault: false,
    active: true,
  },
  {
    id: "req-equipo",
    title: "Equipo que ingresa",
    description: "Laptops, herramientas o equipo de medición, con número de serie.",
    askPhoto: true,
    askText: true,
    required: false,
    applyByDefault: true,
    active: true,
  },
];

export const showcaseSettings: OrganizationSettings = {
  documentRetentionDays: 30,
  documentRetentionUnlimited: true,
  allowDocumentPreviewForGuards: false,
  requireIdentification: true,
  visitorFlow: defaultVisitorFlow,
  earlyEntryMinutes: 15,
  lateEntryMinutes: 30,
  privacyNotice:
    "Los datos personales que proporcionas se utilizan únicamente para gestionar, controlar y auditar tu acceso a nuestras instalaciones. Tu identificación se conserva de forma privada conforme a la política de retención de la empresa. No realizamos reconocimiento facial ni almacenamos datos biométricos.",
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

const DEMO_TZ = "America/Tijuana";

function tijuanaParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: DEMO_TZ,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(date);
  const pick = (type: string) =>
    Number(parts.find((part) => part.type === type)?.value);
  return {
    year: pick("year"),
    month: pick("month"),
    day: pick("day"),
    hour: pick("hour"),
    minute: pick("minute"),
  };
}

/** Hora de pared en Tijuana, igual en el servidor y en el navegador. */
function at(now: Date, dayOffset: number, hour: number, minute = 0) {
  const today = tijuanaParts(now);
  const wallAsUtc = Date.UTC(
    today.year,
    today.month - 1,
    today.day + dayOffset,
    hour,
    minute,
  );
  const shown = tijuanaParts(new Date(wallAsUtc));
  const driftMinutes =
    (Date.UTC(shown.year, shown.month - 1, shown.day, shown.hour, shown.minute) -
      wallAsUtc) /
    60000;
  return new Date(wallAsUtc - driftMinutes * 60000).toISOString();
}

function buildShowcaseVisits(now: Date): Visit[] {
  const nowHour = tijuanaParts(now).hour;
  return Array.from({ length: 26 }, (_, index) => {
  const number = index + 1;
  const status = statuses[index % statuses.length];
  const hour = 8 + (index % 9);
  const host = index % 2 ? showcaseTeam[1] : showcaseTeam[2];
  const location = showcaseLocations[index % 2];
  const siteBooths = showcaseBooths.filter((booth) => booth.locationId === location.id);
  const booth = siteBooths[index % siteBooths.length];
  const inside = status === "checked_in";
  const finished = status === "checked_out";
  const passedGate = inside || finished;
  // Las visitas abiertas se quedan cerca de hoy. Las cerradas se reparten
  // entre este mes y meses anteriores para que la bitácora se pueda auditar.
  const offset = inside
    ? 0
    : status === "invited" || status === "pre_registered"
      ? (index % 3) - 1
      : index % 3 === 0
        ? -18 - (index % 10)
        : -95 - (index % 40);

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
    startsAt: at(now, offset, hour),
    endsAt: at(now, offset, hour + 1),
    checkedInAt: inside
      ? at(now, 0, Math.max(7, nowHour - (index % 3) - 1), 20)
      : finished
        ? at(now, offset, hour, 10)
        : undefined,
    checkedOutAt: finished ? at(now, offset, hour + 1, 5) : undefined,
    checkInBoothId: passedGate ? booth.id : undefined,
    checkInBooth: passedGate ? booth.name : undefined,
    checkInSite: passedGate ? location.name : undefined,
    checkInBy: passedGate ? "Carlos Mendoza" : undefined,
    checkOutBoothId: finished ? booth.id : undefined,
    checkOutBooth: finished ? booth.name : undefined,
    checkOutSite: finished ? location.name : undefined,
    checkOutBy: finished ? "Carlos Mendoza" : undefined,
    denialBoothId: status === "denied" ? booth.id : undefined,
    denialBooth: status === "denied" ? booth.name : undefined,
    deniedBy: status === "denied" ? "Carlos Mendoza" : undefined,
    purpose: purposes[index % purposes.length],
    status: inside ? "checked_in" : status,
    origin: "host_invitation",
    documentCaptured: status !== "invited",
    identityCaptured: status !== "invited",
    vehiclePhotosCaptured: status !== "invited" && index % 4 === 0,
    attachmentsCaptured: status !== "invited" && index % 3 === 0,
    documentType: status !== "invited" ? "INE / IFE" : undefined,
    documentMasked: status !== "invited" ? "•••• 4829" : undefined,
    consentedAt: status !== "invited" ? at(now, offset - 1, 12) : undefined,
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
}

function buildShowcaseEvents(visits: Visit[]): AccessEvent[] {
  return visits
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
      booth: visit.checkInBooth ?? visit.checkOutBooth ?? visit.denialBooth,
    }));
}

let seededKey = "";
let seededState: WorkspaceState = { visits: [], events: [] };

/**
 * La semilla depende del día en Tijuana. Se reconstruye al cambiar el día o la
 * hora, y entre medias devuelve la misma referencia para no disparar un bucle
 * de render. Así un servidor que lleva horas encendido no se queda en el día
 * de ayer mientras el navegador ya calculó el de hoy.
 */
export function getInitialShowcaseState(now = new Date()): WorkspaceState {
  const parts = tijuanaParts(now);
  const key = `${parts.year}-${parts.month}-${parts.day}-${parts.hour}`;
  if (key !== seededKey) {
    const visits = buildShowcaseVisits(now);
    seededKey = key;
    seededState = { visits, events: buildShowcaseEvents(visits) };
  }
  return seededState;
}
