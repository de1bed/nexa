import "server-only";
import { createSign } from "node:crypto";
import { googleWalletConfig } from "./config";
import { appUrl } from "@/lib/config";

/**
 * Pase para Google Wallet.
 *
 * La API acepta un JWT firmado con la llave de una cuenta de servicio que
 * describe el objeto a guardar. No hace falta llamar a ningún endpoint: basta
 * con enviar al visitante a `pay.google.com/gp/v/save/<jwt>`, donde Google crea
 * la clase y el objeto la primera vez que se usan.
 */

export type WalletPassData = {
  token: string;
  visitorName: string;
  organizationName: string;
  hostName: string;
  location: string;
  locationAddress?: string;
  purpose: string;
  startsAt: string;
  endsAt: string;
  accessRequirements?: string;
};

function base64url(value: Buffer | string) {
  return Buffer.from(value)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function sign(payload: object, privateKey: string) {
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const body = base64url(JSON.stringify(payload));
  const signer = createSign("RSA-SHA256");
  signer.update(`${header}.${body}`);
  signer.end();
  return `${header}.${body}.${base64url(signer.sign(privateKey))}`;
}

const dateLabel = (value: string) =>
  new Intl.DateTimeFormat("es-MX", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(new Date(value));

/**
 * Devuelve el enlace «Guardar en Google Wallet», o `null` si la instalación no
 * tiene configurada la integración.
 */
export function googleWalletSaveUrl(pass: WalletPassData): string | null {
  const config = googleWalletConfig();
  if (!config) return null;

  const classId = `${config.issuerId}.${config.classSuffix}`;
  // El identificador del objeto no puede contener el token en claro: se usa el
  // identificador de la visita, que no es secreto por sí solo.
  const objectId = `${config.issuerId}.${pass.token.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 40)}`;

  const genericObject = {
    id: objectId,
    classId,
    genericType: "GENERIC_TYPE_UNSPECIFIED",
    hexBackgroundColor: "#071426",
    cardTitle: {
      defaultValue: { language: "es-MX", value: pass.organizationName },
    },
    header: {
      defaultValue: { language: "es-MX", value: pass.visitorName },
    },
    subheader: {
      defaultValue: { language: "es-MX", value: "Pase de visitante" },
    },
    barcode: {
      type: "QR_CODE",
      value: pass.token,
      alternateText: "Muestra este código en recepción",
    },
    textModulesData: [
      { id: "host", header: "Anfitrión", body: pass.hostName },
      { id: "location", header: "Ubicación", body: pass.location },
      { id: "schedule", header: "Horario", body: dateLabel(pass.startsAt) },
      { id: "purpose", header: "Motivo", body: pass.purpose },
      ...(pass.accessRequirements
        ? [
            {
              id: "requirements",
              header: "Requisitos",
              body: pass.accessRequirements,
            },
          ]
        : []),
    ],
    linksModuleData: {
      uris: [
        {
          uri: `${appUrl()}/pass/${pass.token}`,
          description: "Ver mi pase en línea",
          id: "online",
        },
      ],
    },
    validTimeInterval: {
      start: { date: new Date(pass.startsAt).toISOString() },
      end: { date: new Date(pass.endsAt).toISOString() },
    },
  };

  const claims = {
    iss: config.clientEmail,
    aud: "google",
    typ: "savetowallet",
    iat: Math.floor(Date.now() / 1000),
    origins: [appUrl()],
    payload: { genericObjects: [genericObject] },
  };

  return `https://pay.google.com/gp/v/save/${sign(claims, config.privateKey)}`;
}
