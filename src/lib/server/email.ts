import "server-only";
import { Resend } from "resend";
type InvitationEmail = {
  to: string;
  visitorName: string;
  hostName: string;
  dateLabel: string;
  invitationUrl: string;
};
const escapeHtml = (value: string) =>
  value.replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]!);
export async function sendInvitationEmail(input: InvitationEmail) {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.info("[NEXA VISIT: correo de desarrollo]", {
      to: input.to,
      invitationUrl: input.invitationUrl,
    });
    return { status: "development" as const };
  }
  const resend = new Resend(key);
  const { data, error } = await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL ?? "NEXA VISIT <visitas@example.com>",
    to: input.to,
    subject: `${input.hostName} te invita a una visita`,
    html: `<div style="font-family:Inter,Arial;max-width:560px"><h1>${escapeHtml(input.hostName)} te está invitando.</h1><p>${input.visitorName ? `Hola ${escapeHtml(input.visitorName)}, ` : ""}por favor completa o confirma tus datos para la visita del ${escapeHtml(input.dateLabel)} y presenta el QR generado al personal de seguridad.</p><p><a style="background:#071426;color:white;padding:12px 18px;border-radius:10px;text-decoration:none" href="${escapeHtml(input.invitationUrl)}">Completar mis datos</a></p><p style="color:#64748b;font-size:12px">El enlace es personal y tiene vencimiento.</p></div>`,
  });
  if (error) throw error;
  return { status: "sent" as const, id: data?.id };
}

export async function sendPassEmail(input: {
  to: string;
  visitorName: string;
  passUrl: string;
}) {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.info("[NEXA VISIT: pase de desarrollo]", {
      to: input.to,
      passUrl: input.passUrl,
    });
    return { status: "development" as const };
  }
  const resend = new Resend(key);
  const { data, error } = await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL ?? "NEXA VISIT <visitas@example.com>",
    to: input.to,
    subject: "Tu pase de visitante está listo",
    html: `<div style="font-family:Inter,Arial;max-width:560px"><h1>Tu pase está listo, ${input.visitorName}.</h1><p>Ábrelo al llegar y muestra el QR al personal de seguridad.</p><p><a style="background:#071426;color:white;padding:12px 18px;border-radius:10px;text-decoration:none" href="${input.passUrl}">Abrir mi pase</a></p><p style="color:#64748b;font-size:12px">Este enlace es personal. No lo compartas.</p></div>`,
  });
  if (error) throw error;
  return { status: "sent" as const, id: data?.id };
}

export async function sendHostArrivalEmail(input: {
  to: string;
  hostName: string;
  visitorName: string;
}) {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.info("[NEXA VISIT: llegada de desarrollo]", input);
    return { status: "development" as const };
  }
  const resend = new Resend(key);
  const { data, error } = await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL ?? "NEXA VISIT <visitas@example.com>",
    to: input.to,
    subject: `${input.visitorName} ha llegado`,
    html: `<div style="font-family:Inter,Arial"><h1>Tu visitante ha llegado</h1><p>Hola ${input.hostName}, ${input.visitorName} acaba de registrar su entrada en recepción.</p></div>`,
  });
  if (error) throw error;
  return { status: "sent" as const, id: data?.id };
}
