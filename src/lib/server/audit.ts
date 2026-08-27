import "server-only";
import { createAdminClient } from "./supabase-admin";
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
export async function writeNotification(input: {
  organizationId: string;
  visitId?: string;
  recipientMasked: string;
  template: string;
  status: string;
}) {
  const { error } = await createAdminClient()
    .from("notification_logs")
    .insert({
      organization_id: input.organizationId,
      visit_id: input.visitId ?? null,
      channel: "email",
      recipient_masked: input.recipientMasked,
      template: input.template,
      status: input.status,
    });
  if (error) throw error;
}
