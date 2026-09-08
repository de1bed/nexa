import "server-only";
import { Resend } from "resend";
import { escapeHtml } from "@/lib/security";

/**
 * Adaptador de correo. Sin RESEND_API_KEY registra el destinatario y el enlace
 * en consola, de modo que el recorrido completo es verificable en desarrollo.
 * Todo texto dinámico se escapa antes de entrar al HTML.
 */

export type DeliveryStatus = "sent" | "development" | "failed";
export type DeliveryResult = { status: DeliveryStatus; id?: string };

const brand = {
  ink: "#071426",
  accent: "#10cfc9",
  muted: "#64748b",
};

function layout(options: {
  preheader: string;
  title: string;
  body: string;
  ctaLabel?: string;
  ctaUrl?: string;
  footnote?: string;
}) {
  const cta =
    options.ctaLabel && options.ctaUrl
      ? `<tr><td style="padding:28px 0 8px"><a href="${escapeHtml(options.ctaUrl)}" style="display:inline-block;background:${brand.ink};color:#ffffff;padding:15px 26px;border-radius:14px;text-decoration:none;font-weight:600;font-size:16px">${escapeHtml(options.ctaLabel)}</a></td></tr>`
      : "";
  const footnote = options.footnote
    ? `<tr><td style="padding-top:22px;color:${brand.muted};font-size:12px;line-height:20px">${escapeHtml(options.footnote)}</td></tr>`
    : "";

  return `<!doctype html><html lang="es"><body style="margin:0;background:#f1f5f9;padding:24px 12px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,Arial,sans-serif">
<span style="display:none;font-size:1px;color:#f1f5f9">${escapeHtml(options.preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:24px;overflow:hidden;box-shadow:0 18px 48px -28px rgba(7,20,38,.45)">
<tr><td style="background:${brand.ink};padding:22px 28px">
<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
<td width="38" height="38" align="center" valign="middle" style="width:38px;height:38px;background:${brand.accent};border-radius:11px;font-family:'Segoe UI','Segoe UI Symbol','Apple Symbols',Arial,sans-serif;font-size:20px;font-weight:700;line-height:38px;color:#043b39">&#10003;</td>
<td valign="middle" style="padding-left:12px;color:#ffffff;font-size:13px;font-weight:600;letter-spacing:.18em">NEXA VISIT</td>
</tr></table>
</td></tr>
<tr><td style="padding:32px 28px 34px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
<tr><td style="font-size:24px;line-height:32px;font-weight:600;color:${brand.ink};letter-spacing:-.02em">${options.title}</td></tr>
<tr><td style="padding-top:14px;font-size:16px;line-height:26px;color:#334155">${options.body}</td></tr>
${cta}
${footnote}
</table>
</td></tr>
</table>
<p style="max-width:560px;color:${brand.muted};font-size:11px;line-height:18px;padding:16px 6px 0;text-align:center">Recibes este mensaje porque una empresa registró una visita a su nombre. Si no la esperabas, ignora el correo.</p>
</td></tr></table></body></html>`;
}

async function deliver(input: {
  to: string;
  subject: string;
  html: string;
  logLabel: string;
  logPayload: Record<string, unknown>;
}): Promise<DeliveryResult> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.info(`[NEXA VISIT · correo de desarrollo] ${input.logLabel}`, {
      to: input.to,
      ...input.logPayload,
    });
    return { status: "development" };
  }
  const resend = new Resend(key);
  const { data, error } = await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL ?? "NEXA VISIT <visitas@example.com>",
    to: input.to,
    subject: input.subject,
    html: input.html,
  });
  if (error) throw error;
  return { status: "sent", id: data?.id };
}

export async function sendInvitationEmail(input: {
  to: string;
  visitorName: string;
  hostName: string;
  organizationName: string;
  dateLabel: string;
  locationName: string;
  invitationUrl: string;
}): Promise<DeliveryResult> {
  const greeting = input.visitorName
    ? `Hola ${escapeHtml(input.visitorName)}: `
    : "";
  return deliver({
    to: input.to,
    subject: `${input.hostName} te invita a ${input.organizationName}`,
    logLabel: "invitación",
    logPayload: { invitationUrl: input.invitationUrl },
    html: layout({
      preheader: `Completa tu registro para la visita del ${input.dateLabel}.`,
      title: `${escapeHtml(input.hostName)} te está esperando`,
      body: `${greeting}completa tu registro desde el teléfono en menos de dos minutos y recibirás un pase QR para entrar sin filas.<br><br><b>${escapeHtml(input.dateLabel)}</b><br>${escapeHtml(input.organizationName)} · ${escapeHtml(input.locationName)}`,
      ctaLabel: "Completar mi registro",
      ctaUrl: input.invitationUrl,
      footnote:
        "El enlace es personal, vence después de la visita y no debe compartirse.",
    }),
  });
}

export async function sendPassEmail(input: {
  to: string;
  visitorName: string;
  organizationName: string;
  dateLabel: string;
  passUrl: string;
}): Promise<DeliveryResult> {
  return deliver({
    to: input.to,
    subject: "Tu pase de acceso está listo",
    logLabel: "pase",
    logPayload: { passUrl: input.passUrl },
    html: layout({
      preheader: "Muestra este pase al llegar a recepción.",
      title: `Todo listo, ${escapeHtml(input.visitorName)}`,
      body: `Tu pase de acceso para <b>${escapeHtml(input.organizationName)}</b> ya está activo.<br><br><b>${escapeHtml(input.dateLabel)}</b><br><br>Ábrelo al llegar y muestra el código QR al personal de seguridad.`,
      ctaLabel: "Abrir mi pase",
      ctaUrl: input.passUrl,
      footnote:
        "Guarda este correo. El pase se desactiva automáticamente al registrar tu salida.",
    }),
  });
}

export async function sendHostArrivalEmail(input: {
  to: string;
  hostName: string;
  visitorName: string;
  locationName: string;
  timeLabel: string;
}): Promise<DeliveryResult> {
  return deliver({
    to: input.to,
    subject: `${input.visitorName} llegó a recepción`,
    logLabel: "llegada",
    logPayload: { visitorName: input.visitorName },
    html: layout({
      preheader: `${input.visitorName} está en recepción.`,
      title: "Tu visitante ya llegó",
      body: `Hola ${escapeHtml(input.hostName)}: <b>${escapeHtml(input.visitorName)}</b> registró su entrada en ${escapeHtml(input.locationName)} a las ${escapeHtml(input.timeLabel)}.`,
      footnote: "Registro generado automáticamente por control de accesos.",
    }),
  });
}

export async function sendTeamInviteEmail(input: {
  to: string;
  fullName: string;
  organizationName: string;
  roleLabel: string;
  actionUrl: string;
  otp?: string;
  existingAccount?: boolean;
}): Promise<DeliveryResult> {
  const otpBlock = input.otp
    ? `<br><br>Tu código de un solo uso:<br><br><span style="display:inline-block;font-size:32px;letter-spacing:.28em;font-weight:700;color:${brand.ink}">${escapeHtml(input.otp)}</span><br><br>Ábrelo, escríbelo y elige tu contraseña. Los siguientes ingresos ya no lo piden.`
    : input.existingAccount
      ? "<br><br>Entra con tu correo y contraseña de siempre. Si es la primera vez, pide un código en la pantalla de acceso."
      : "<br><br>Entra con este correo, pide el código de una sola vez y elige tu contraseña.";

  return deliver({
    to: input.to,
    subject: `Te agregaron a ${input.organizationName} en NEXA VISIT`,
    logLabel: "invitación de equipo",
    logPayload: { actionUrl: input.actionUrl, existingAccount: Boolean(input.existingAccount) },
    html: layout({
      preheader: input.otp
        ? "Tu código de acceso está en este correo."
        : "Entra con tu correo para empezar a operar.",
      title: `Bienvenido a ${escapeHtml(input.organizationName)}`,
      body: `Hola ${escapeHtml(input.fullName)}: te dieron acceso como <b>${escapeHtml(input.roleLabel)}</b>.${otpBlock}`,
      ctaLabel: "Entrar a NEXA VISIT",
      ctaUrl: input.actionUrl,
      footnote: input.otp
        ? "El código vence en una hora y no debe compartirse."
        : "Si no esperabas este acceso, ignora el correo.",
    }),
  });
}
