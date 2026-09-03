-- ============================================================================
-- Canal de WhatsApp en la bitácora de notificaciones
--
-- El registro de envíos ya cubría correo, SMS y avisos dentro de la aplicación.
-- Al agregar el envío del enlace por WhatsApp hace falta poder registrarlo con
-- las mismas garantías: destinatario enmascarado, plantilla y estado.
-- ============================================================================

alter table public.notification_logs
  drop constraint if exists notification_logs_channel_check;

alter table public.notification_logs
  add constraint notification_logs_channel_check
  check (channel in ('email', 'sms', 'whatsapp', 'in_app'));
