import "server-only";
import type { DeliveryStatus } from "./email";

/**
 * Envío del enlace de invitación por WhatsApp con la API de Meta Cloud.
 *
 * WhatsApp no permite iniciar una conversación con texto libre: el primer
 * mensaje debe usar una **plantilla aprobada** por Meta. Por eso aquí solo se
 * rellenan sus variables; el texto vive en la plantilla, no en el código.
 *
 * Plantilla esperada (nombre configurable), con cuatro variables en el cuerpo y
 * un botón de URL dinámica:
 *
 *   Hola {{1}}: {{2}} te invita a {{3}} el {{4}}.
 *   Completa tu registro y recibe tu pase de acceso.
 *   [Botón URL] https://tu-dominio.com/visit/{{1}}
 *
 * Sin credenciales configuradas, el mensaje se registra en consola igual que el
 * correo de desarrollo, para poder seguir el recorrido completo sin cuenta.
 */

const GRAPH_VERSION = "v21.0";

export function whatsappConfigured() {
  return Boolean(
    process.env.WHATSAPP_PHONE_NUMBER_ID && process.env.WHATSAPP_ACCESS_TOKEN,
  );
}

/**
 * Normaliza a E.164 sin el signo «+», que es lo que espera la API.
 * Un número local de diez dígitos recibe el código de país configurado.
 */
export function toE164(phone: string, defaultCountryCode = process.env.WHATSAPP_DEFAULT_COUNTRY_CODE ?? "52") {
  const digits = phone.replace(/\D/g, "");
  if (!digits) return null;
  if (phone.trim().startsWith("+")) return digits;
  if (digits.length === 10) return `${defaultCountryCode}${digits}`;
  return digits;
}

export type WhatsAppInvitation = {
  to: string;
  visitorName: string;
  hostName: string;
  organizationName: string;
  dateLabel: string;
  /** Parte del enlace que se inyecta en el botón de la plantilla. */
  invitationPath: string;
};

export async function sendInvitationWhatsApp(
  input: WhatsAppInvitation,
): Promise<{ status: DeliveryStatus; id?: string }> {
  const to = toE164(input.to);
  if (!to) return { status: "failed" };

  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;

  if (!phoneNumberId || !accessToken) {
    console.info("[NEXA VISIT · WhatsApp de desarrollo]", {
      to,
      invitationPath: input.invitationPath,
    });
    return { status: "development" };
  }

  const body = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to,
    type: "template",
    template: {
      name: process.env.WHATSAPP_TEMPLATE_NAME ?? "nexa_visit_invitation",
      language: { code: process.env.WHATSAPP_TEMPLATE_LANG ?? "es_MX" },
      components: [
        {
          type: "body",
          parameters: [
            { type: "text", text: input.visitorName || "visitante" },
            { type: "text", text: input.hostName },
            { type: "text", text: input.organizationName },
            { type: "text", text: input.dateLabel },
          ],
        },
        {
          type: "button",
          sub_type: "url",
          index: "0",
          parameters: [{ type: "text", text: input.invitationPath }],
        },
      ],
    },
  };

  const response = await fetch(
    `https://graph.facebook.com/${GRAPH_VERSION}/${phoneNumberId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    },
  );

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    // El detalle puede contener el número: se registra solo el motivo.
    console.error(
      "WhatsApp delivery failed",
      response.status,
      detail.slice(0, 300),
    );
    return { status: "failed" };
  }

  const payload = (await response.json().catch(() => null)) as {
    messages?: Array<{ id?: string }>;
  } | null;

  return { status: "sent", id: payload?.messages?.[0]?.id };
}
