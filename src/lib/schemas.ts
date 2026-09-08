import { z } from "zod";

/** Esquemas compartidos por los formularios del cliente y las rutas del servidor. */

const optionalText = (max: number) => z.string().trim().max(max).optional();

export const invitationSchema = z
  .object({
    visitorName: z.string().trim().max(120),
    email: z.union([z.literal(""), z.email("Correo inválido")]),
    phone: z.string().trim().max(30),
    company: z.string().trim().max(120),
    locationId: z.string().min(1, "Elige una ubicación"),
    hostId: optionalText(80),
    date: z.string().min(1, "Elige una fecha"),
    startTime: z.string().min(1),
    endTime: z.string().min(1),
    purpose: z.string().trim().min(2, "Describe el motivo").max(160),
    notes: optionalText(500),
    accessRequirements: optionalText(500),
    sendEmail: z.boolean(),
    sendWhatsApp: z.boolean(),
  })
  .refine((value) => value.endTime > value.startTime, {
    message: "La hora final debe ser posterior a la inicial",
    path: ["endTime"],
  })
  .refine((value) => !value.sendEmail || Boolean(value.email), {
    message: "Agrega un correo para poder enviar la invitación",
    path: ["email"],
  })
  .refine((value) => !value.sendWhatsApp || Boolean(value.phone), {
    message: "Agrega un teléfono para poder enviar por WhatsApp",
    path: ["phone"],
  });

export type InvitationInput = z.infer<typeof invitationSchema>;

export const visitorRegistrationSchema = z.object({
  fullName: z.string().trim().min(2, "Escribe tu nombre completo").max(120),
  email: z.email("Correo inválido"),
  phone: z.string().trim().min(7, "Teléfono incompleto").max(30),
  company: z.string().trim().min(2, "Escribe tu empresa").max(120),
  documentType: z.string().min(1),
  documentNumber: optionalText(80),
  vehiclePlate: optionalText(20),
  visitorNotes: optionalText(500),
  consent: z.literal(true, { error: "Debes aceptar el aviso de privacidad" }),
});

export const manualVisitSchema = z.object({
  visitorName: z.string().trim().min(2, "Escribe el nombre").max(120),
  email: z.union([z.literal(""), z.email("Correo inválido")]),
  phone: optionalText(30),
  company: z.string().trim().min(2, "Escribe la empresa").max(120),
  hostId: z.string().min(1, "Elige un anfitrión"),
  locationId: z.string().min(1, "Elige una ubicación"),
  purpose: z.string().trim().min(2, "Describe el motivo").max(160),
  consent: z
    .boolean()
    .refine(Boolean, "Confirma que el visitante aceptó el aviso"),
});

export const onboardingSchema = z.object({
  organizationName: z
    .string()
    .trim()
    .min(2, "Escribe el nombre de la empresa")
    .max(120),
  fullName: z.string().trim().min(2, "Escribe tu nombre").max(120),
  locationName: z.string().trim().min(2, "Nombra tu recepción").max(120),
  locationAddress: z.string().trim().min(5, "Escribe la dirección").max(300),
  timezone: z.string().trim().min(3).max(80),
});

export const teamInviteSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  email: z.email("Correo inválido"),
  role: z.enum(["admin", "host", "guard"]),
});

export const teamUpdateSchema = z.object({
  role: z.enum(["admin", "host", "guard"]).optional(),
  active: z.boolean().optional(),
  status: z.enum(["invited", "active", "suspended"]).optional(),
});

export const teamAcceptSchema = z.object({
  password: z
    .string()
    .min(8, "La contraseña debe tener al menos 8 caracteres")
    .max(72, "La contraseña es demasiado larga"),
});

export const locationSchema = z.object({
  name: z.string().trim().min(2).max(120),
  address: z.string().trim().min(5).max(300),
  timezone: z.string().trim().min(3).max(80),
});

export const settingsSchema = z.object({
  documentRetentionDays: z.number().int().min(1).max(365),
  allowDocumentPreviewForGuards: z.boolean(),
  requireIdentification: z.boolean(),
  earlyEntryMinutes: z.number().int().min(0).max(240),
  lateEntryMinutes: z.number().int().min(0).max(1440),
  privacyNotice: z.string().trim().min(40).max(4000),
});

export const signUpSchema = z.object({
  fullName: z.string().trim().min(2, "Escribe tu nombre").max(120),
  email: z.email("Correo inválido"),
});

export const accessEmailSchema = z.email("Correo inválido");

export const passwordSchema = z
  .string()
  .min(8, "La contraseña debe tener al menos 8 caracteres")
  .max(72, "La contraseña es demasiado larga");

export const signInSchema = z.object({
  email: z.email("Correo inválido"),
  password: z.string().min(1, "Escribe tu contraseña"),
});

/** Código de un solo uso que Supabase envía por correo. */
export const accessCodeSchema = z
  .string()
  .trim()
  .regex(/^\d{6}$/, "El código tiene 6 dígitos");
