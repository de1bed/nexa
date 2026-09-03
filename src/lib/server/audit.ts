import "server-only";
import { createAdminClient } from "./supabase-admin";
import type { DeliveryStatus } from "./email";

/**
 * Bitácora append-only. Se escribe con la llave de servicio porque debe
 * registrar incluso acciones de usuarios sin permiso de lectura sobre la tabla.
 */
export async function writeAudit(input: {
  organizationId: string;
  actorId?: string;
  visitId?: string;
  eventType: string;
  metadata?: Record<string, unknown>;
}) {
  const { error } = await createAdminClient()
    .from("audit_logs")
    .insert({
      organization_id: input.organizationId,
      actor_id: input.actorId ?? null,
      visit_id: input.visitId ?? null,
      event_type: input.eventType,
      metadata: input.metadata ?? {},
    });
  if (error) throw error;
}

/** Registro de envíos. Nunca guarda el destinatario en claro. */
export async function writeNotification(input: {
  organizationId: string;
  visitId?: string;
  recipientMasked: string;
  template: string;
  status: DeliveryStatus;
  channel?: "email" | "sms" | "whatsapp" | "in_app";
}) {
  const { error } = await createAdminClient()
    .from("notification_logs")
    .insert({
      organization_id: input.organizationId,
      visit_id: input.visitId ?? null,
      channel: input.channel ?? "email",
      recipient_masked: input.recipientMasked,
      template: input.template,
      status: input.status,
    });
  if (error) throw error;
}
