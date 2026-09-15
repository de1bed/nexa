/**
 * Política de pasos del registro del visitante.
 *
 * Cada empresa decide si un paso no se pide, es opcional u obligatorio.
 * Los defaults replican el flujo que ya está en producción: datos e INE
 * obligatorios, placa y notas opcionales en «Detalles finales», anexos
 * apagados y consentimiento obligatorio.
 */

export const stepPolicies = ["off", "optional", "required"] as const;
export type StepPolicy = (typeof stepPolicies)[number];

export const visitorFlowKeys = [
  "identity",
  "identification",
  "vehicle",
  "notes",
  "attachments",
  "consent",
] as const;
export type VisitorFlowKey = (typeof visitorFlowKeys)[number];
export type VisitorFlowConfig = Record<VisitorFlowKey, StepPolicy>;

export const FALLBACK_VISITOR_NAME = "Visitante";

export const defaultVisitorFlow: VisitorFlowConfig = {
  identity: "required",
  identification: "required",
  vehicle: "optional",
  notes: "optional",
  attachments: "off",
  consent: "required",
};

export const visitorFlowStepMeta: Record<
  VisitorFlowKey,
  { label: string; description: string }
> = {
  identity: {
    label: "Datos de contacto",
    description: "Nombre, correo, teléfono y empresa.",
  },
  identification: {
    label: "Identificación",
    description: "Foto del frente y reverso de la credencial.",
  },
  vehicle: {
    label: "Vehículo",
    description: "Número de placas y fotos del vehículo.",
  },
  notes: {
    label: "Notas para recepción",
    description: "Comentarios que el visitante deja a caseta.",
  },
  attachments: {
    label: "Anexos",
    description: "Fotos adicionales que la empresa quiera pedir.",
  },
  consent: {
    label: "Aviso de privacidad",
    description: "Lectura y aceptación del aviso de la empresa.",
  },
};

export type RegistrationStep =
  | "welcome"
  | "identity"
  | "document"
  | "review"
  | "vehicle"
  | "extras"
  | "attachments"
  | "consent"
  | "done";

export const IDENTITY_DOCUMENT_TYPES = [
  "identity_front",
  "identity_back",
  "manual_capture",
] as const;

export type StoredDocumentType =
  | (typeof IDENTITY_DOCUMENT_TYPES)[number]
  | "vehicle_plate"
  | "attachment";

export type DocumentKind = "identification" | "vehicle" | "attachment" | "other";

export const documentSideLabels: Record<string, string> = {
  identity_front: "Frente",
  identity_back: "Reverso",
  manual_capture: "Captura en caseta",
  vehicle_plate: "Placa",
  attachment: "Anexo",
};

export function isStepPolicy(value: unknown): value is StepPolicy {
  return value === "off" || value === "optional" || value === "required";
}

export function visitorFlowFromIdentification(
  requireIdentification: boolean,
): VisitorFlowConfig {
  return {
    ...defaultVisitorFlow,
    identification: requireIdentification ? "required" : "off",
  };
}

export function parseVisitorFlow(
  raw: unknown,
  requireIdentification = true,
): VisitorFlowConfig {
  const parsed: VisitorFlowConfig = visitorFlowFromIdentification(
    requireIdentification,
  );
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return parsed;
  const record = raw as Record<string, unknown>;
  for (const key of visitorFlowKeys) {
    if (isStepPolicy(record[key])) parsed[key] = record[key];
  }
  return parsed;
}

/** Compatibilidad con el flag histórico: solo true cuando la INE es obligatoria. */
export function requireIdentificationFromFlow(flow: VisitorFlowConfig) {
  return flow.identification === "required";
}

export function extrasVisible(flow: VisitorFlowConfig) {
  return flow.vehicle === "optional" || flow.notes !== "off";
}

export function extrasShowsVehicle(flow: VisitorFlowConfig) {
  return flow.vehicle === "optional";
}

export function extrasShowsNotes(flow: VisitorFlowConfig) {
  return flow.notes !== "off";
}

/**
 * Pasos de captura en orden, sin portada ni confirmación de INE.
 * `review` se inserta en la UI solo si ya hay fotos de identificación.
 */
export function registrationSteps(flow: VisitorFlowConfig): RegistrationStep[] {
  const steps: RegistrationStep[] = [];
  if (flow.identity !== "off") steps.push("identity");
  if (flow.identification !== "off") steps.push("document");
  if (flow.vehicle === "required") steps.push("vehicle");
  if (extrasVisible(flow)) steps.push("extras");
  if (flow.attachments !== "off") steps.push("attachments");
  if (flow.consent !== "off") steps.push("consent");
  return steps;
}

export function registrationPath(
  flow: VisitorFlowConfig,
  hasIdentityPhotos: boolean,
): RegistrationStep[] {
  return registrationSteps(flow).flatMap((step): RegistrationStep[] =>
    step === "document" && hasIdentityPhotos ? ["document", "review"] : [step],
  );
}

export function firstRegistrationStep(
  flow: VisitorFlowConfig,
): RegistrationStep {
  return registrationSteps(flow)[0] ?? "done";
}

export function stepAfter(
  current: RegistrationStep,
  flow: VisitorFlowConfig,
  hasIdentityPhotos: boolean,
): RegistrationStep {
  const path: RegistrationStep[] = [
    ...registrationPath(flow, hasIdentityPhotos),
    "done",
  ];
  const index = path.indexOf(current);
  if (index < 0) return path[0] ?? "done";
  return path[index + 1] ?? "done";
}

export function stepBefore(
  current: RegistrationStep,
  flow: VisitorFlowConfig,
  hasIdentityPhotos: boolean,
): RegistrationStep {
  const path: RegistrationStep[] = [
    "welcome",
    ...registrationPath(flow, hasIdentityPhotos),
  ];
  const index = path.indexOf(current);
  if (index <= 0) return "welcome";
  return path[index - 1] ?? "welcome";
}

export function documentFlags(types: Array<string | null | undefined>) {
  const identityCaptured = types.some(
    (type) => documentKind(type) === "identification",
  );
  const vehiclePhotosCaptured = types.some(
    (type) => documentKind(type) === "vehicle",
  );
  const attachmentsCaptured = types.some(
    (type) => documentKind(type) === "attachment",
  );
  return {
    identityCaptured,
    vehiclePhotosCaptured,
    attachmentsCaptured,
    documentCaptured:
      identityCaptured || vehiclePhotosCaptured || attachmentsCaptured,
  };
}

export function documentKind(type?: string | null): DocumentKind {
  if (
    type === "identity_front" ||
    type === "identity_back" ||
    type === "manual_capture"
  )
    return "identification";
  if (type === "vehicle_plate") return "vehicle";
  if (type === "attachment") return "attachment";
  return "other";
}

export function resolvedVisitorName(
  provided: string | undefined,
  invitedName: string | undefined,
  policy: StepPolicy,
) {
  const written = provided?.trim() ?? "";
  if (written.length >= 2) return written;
  const invited = invitedName?.trim() ?? "";
  if (invited.length >= 2) return invited;
  return policy === "required" ? written : FALLBACK_VISITOR_NAME;
}

export type RegistrationInput = {
  fullName: string;
  email: string;
  phone: string;
  company: string;
  vehiclePlate: string;
  visitorNotes: string;
  consent: boolean;
  identityPhotos: number;
  vehiclePhotos: number;
  attachmentPhotos: number;
  invitedName?: string;
};

export type RegistrationError =
  | "name_required"
  | "email_invalid"
  | "phone_required"
  | "company_required"
  | "identity_photos_required"
  | "identity_front_required"
  | "identity_back_required"
  | "plate_required"
  | "plate_photo_required"
  | "notes_required"
  | "attachment_required"
  | "consent_required";

export function validateRegistration(
  input: RegistrationInput,
  flow: VisitorFlowConfig,
): RegistrationError | null {
  if (flow.identity === "required") {
    if (input.fullName.trim().length < 2) return "name_required";
    if (!isEmail(input.email)) return "email_invalid";
    if (input.phone.trim().length < 7) return "phone_required";
    if (input.company.trim().length < 2) return "company_required";
  } else if (flow.identity === "optional") {
    if (input.email.trim() && !isEmail(input.email)) return "email_invalid";
    if (input.phone.trim() && input.phone.trim().length < 7)
      return "phone_required";
  }

  if (flow.identification === "required" && input.identityPhotos < 2)
    return "identity_photos_required";

  if (flow.vehicle === "required") {
    if (!input.vehiclePlate.trim()) return "plate_required";
    if (input.vehiclePhotos < 1) return "plate_photo_required";
  }

  if (flow.notes === "required" && !input.visitorNotes.trim())
    return "notes_required";

  if (flow.attachments === "required" && input.attachmentPhotos < 1)
    return "attachment_required";

  if (flow.consent === "required" && !input.consent) return "consent_required";

  return null;
}

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}
