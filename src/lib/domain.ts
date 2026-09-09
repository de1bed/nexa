/**
 * Contrato único de dominio compartido por servidor y cliente.
 * Las respuestas de las APIs se normalizan a estas formas para que la interfaz
 * sea idéntica en modo vitrina y contra Supabase.
 */

export const visitStatuses = [
  "draft",
  "invited",
  "pre_registered",
  "approved",
  "checked_in",
  "checked_out",
  "denied",
  "cancelled",
  "expired",
] as const;

export type VisitStatus = (typeof visitStatuses)[number];
export type MemberRole = "superadmin" | "admin" | "host" | "guard";
export type VisitOrigin = "host_invitation" | "public_link" | "guard_manual";

export type Visit = {
  id: string;
  visitorName: string;
  email: string;
  phone?: string;
  company: string;
  hostId: string;
  hostName: string;
  hostEmail?: string;
  locationId?: string;
  location: string;
  locationAddress?: string;
  startsAt: string;
  endsAt: string;
  checkedInAt?: string;
  checkedOutAt?: string;
  purpose: string;
  status: VisitStatus;
  origin: VisitOrigin;
  notes?: string;
  visitorNotes?: string;
  accessRequirements?: string;
  vehiclePlate?: string;
  documentType?: string;
  documentMasked?: string;
  invitationToken?: string;
  qrToken?: string;
  documentCaptured: boolean;
  consentedAt?: string;
  denialReason?: string;
  /** Datos que el anfitrión adelantó; el visitante los confirma o corrige. */
  inviteeName?: string;
  inviteeEmail?: string;
  inviteePhone?: string;
  inviteeCompany?: string;
};

export const accessEventTypes = [
  "invitation_created",
  "invitation_resent",
  "pre_registered",
  "qr_scanned",
  "check_in",
  "check_out",
  "denied",
  "cancelled",
] as const;

export type AccessEventType = (typeof accessEventTypes)[number];

export type AccessEvent = {
  id: string;
  visitId: string;
  type: AccessEventType;
  at: string;
  actor: string;
  detail?: string;
};

export type Location = {
  id: string;
  name: string;
  address: string;
  timezone: string;
  active: boolean;
};

export type MemberStatus = "invited" | "active" | "suspended";

export type TeamMember = {
  id: string;
  name: string;
  email: string;
  role: MemberRole;
  active: boolean;
  status: MemberStatus;
  joinedAt?: string;
  invitedAt?: string;
  inviteDelivery?: "sent" | "failed" | "development";
};

export const memberStatusLabels: Record<MemberStatus, string> = {
  invited: "Invitación enviada",
  active: "Miembro",
  suspended: "Suspendido",
};

export type OrganizationSettings = {
  documentRetentionDays: number;
  allowDocumentPreviewForGuards: boolean;
  requireIdentification: boolean;
  earlyEntryMinutes: number;
  lateEntryMinutes: number;
  privacyNotice: string;
  privacyNoticeVersion: string;
};

export type WorkspaceState = {
  visits: Visit[];
  events: AccessEvent[];
};

export const statusLabels: Record<VisitStatus, string> = {
  draft: "Borrador",
  invited: "Invitada",
  pre_registered: "Lista para entrar",
  approved: "Aprobada",
  checked_in: "Dentro",
  checked_out: "Salida registrada",
  denied: "Denegada",
  cancelled: "Cancelada",
  expired: "Vencida",
};

export const eventLabels: Record<AccessEventType, string> = {
  invitation_created: "Invitación creada",
  invitation_resent: "Invitación reenviada",
  pre_registered: "Preregistro completado",
  qr_scanned: "Pase escaneado",
  check_in: "Entrada registrada",
  check_out: "Salida registrada",
  denied: "Acceso denegado",
  cancelled: "Visita cancelada",
};

export const roleLabels: Record<MemberRole, string> = {
  superadmin: "Superadministración",
  admin: "Administración",
  host: "Anfitrión",
  guard: "Guardia",
};

export const visitPurposes = [
  "Reunión comercial",
  "Entrega de proveedor",
  "Entrevista",
  "Auditoría",
  "Soporte técnico",
  "Mantenimiento",
  "Capacitación",
  "Visita ejecutiva",
] as const;

export const documentTypes = [
  "INE / IFE",
  "Pasaporte",
  "Licencia de conducir",
  "Cédula profesional",
  "Credencial laboral",
  "Otra",
] as const;

/** Milisegundos que una visita lleva dentro de las instalaciones. */
export function timeInsideMs(visit: Visit, now = Date.now()) {
  if (!visit.checkedInAt) return 0;
  const start = new Date(visit.checkedInAt).getTime();
  const end = visit.checkedOutAt ? new Date(visit.checkedOutAt).getTime() : now;
  return Math.max(0, end - start);
}

/** "1 h 24 min" — formato compacto y legible en pantallas pequeñas. */
export function formatDuration(ms: number) {
  const totalMinutes = Math.floor(ms / 60000);
  if (totalMinutes < 1) return "menos de 1 min";
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes} min`;
  if (minutes === 0) return `${hours} h`;
  return `${hours} h ${minutes} min`;
}

const dateTimeMx = new Intl.DateTimeFormat("es-MX", {
  dateStyle: "medium",
  timeStyle: "short",
});

/** Fecha y hora locales para bitácoras, CSV y pases. */
export function formatDateTimeMx(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return dateTimeMx.format(date);
}

/** Estado de la ventana de acceso de una visita respecto a un instante dado. */
export function accessWindow(
  visit: Pick<Visit, "startsAt" | "endsAt">,
  options: { earlyMinutes?: number; lateMinutes?: number; now?: Date } = {},
) {
  const early = options.earlyMinutes ?? 15;
  const late = options.lateMinutes ?? 30;
  const now = (options.now ?? new Date()).getTime();
  const opens = new Date(visit.startsAt).getTime() - early * 60000;
  const closes = new Date(visit.endsAt).getTime() + late * 60000;
  if (now < opens) return "early" as const;
  if (now > closes) return "late" as const;
  return "valid" as const;
}

/**
 * Formatea una fecha «AAAA-MM-DD» que no lleva hora.
 *
 * `new Date("2030-12-31")` se interpreta como medianoche UTC, así que al
 * mostrarla en una zona al oeste de Greenwich retrocede un día. Fijar la zona
 * en UTC mantiene el día que realmente venía en el dato.
 */
export function formatIsoDate(value: string) {
  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "long",
    timeZone: "UTC",
  }).format(new Date(value));
}

export function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .map((part) => part[0] ?? "")
    .slice(0, 2)
    .join("")
    .toUpperCase();
}
