import "server-only";
import { PKPass } from "passkit-generator";
import { appleWalletConfig } from "./config";
import type { WalletPassData } from "./google";
import { appUrl } from "@/lib/config";

/**
 * Pase para Apple Wallet (.pkpass).
 *
 * Un .pkpass es un ZIP firmado con el certificado del Pass Type ID emitido por
 * Apple. La firma la hace `passkit-generator`; aquí solo se describe el pase y
 * se le da forma de tarjeta de evento, que es la que mejor encaja con una
 * visita: tiene lugar, horario y código de barras.
 */

const timeLabel = (value: string) =>
  new Intl.DateTimeFormat("es-MX", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));

/**
 * Genera el archivo del pase, o `null` si la instalación no tiene configurados
 * los certificados de Apple.
 */
export async function buildApplePass(
  pass: WalletPassData,
): Promise<Buffer | null> {
  const config = appleWalletConfig();
  if (!config) return null;

  const instance = new PKPass(
    {},
    {
      wwdr: config.wwdr,
      signerCert: config.signerCert,
      signerKey: config.signerKey,
      signerKeyPassphrase: config.signerKeyPassphrase,
    },
    {
      passTypeIdentifier: config.passTypeIdentifier,
      teamIdentifier: config.teamIdentifier,
      organizationName: config.organizationName,
      serialNumber: pass.token,
      description: `Pase de visitante · ${pass.organizationName}`,
      foregroundColor: "rgb(255, 255, 255)",
      backgroundColor: "rgb(7, 20, 38)",
      labelColor: "rgb(16, 207, 201)",
      logoText: pass.organizationName,
      sharingProhibited: true,
    },
  );

  instance.type = "eventTicket";

  instance.setBarcodes({
    message: pass.token,
    format: "PKBarcodeFormatQR",
    messageEncoding: "iso-8859-1",
    altText: "Muestra este código en recepción",
  });

  // El pase deja de tener sentido cuando termina la ventana de la visita.
  instance.setExpirationDate(new Date(pass.endsAt));
  if (pass.locationAddress) instance.setRelevantDate(new Date(pass.startsAt));

  instance.primaryFields.push({
    key: "visitor",
    label: "VISITANTE",
    value: pass.visitorName,
  });

  instance.secondaryFields.push(
    { key: "host", label: "ANFITRIÓN", value: pass.hostName },
    { key: "location", label: "UBICACIÓN", value: pass.location },
  );

  instance.auxiliaryFields.push({
    key: "schedule",
    label: "HORARIO",
    value: timeLabel(pass.startsAt),
  });

  instance.backFields.push(
    { key: "purpose", label: "Motivo de la visita", value: pass.purpose },
    ...(pass.locationAddress
      ? [
          {
            key: "address",
            label: "Dirección",
            value: pass.locationAddress,
          },
        ]
      : []),
    ...(pass.accessRequirements
      ? [
          {
            key: "requirements",
            label: "Requisitos de acceso",
            value: pass.accessRequirements,
          },
        ]
      : []),
    {
      key: "online",
      label: "Ver en línea",
      value: `${appUrl()}/pass/${pass.token}`,
    },
    {
      key: "privacy",
      label: "Privacidad",
      value:
        "Este pase contiene únicamente un token aleatorio. No incluye tu identificación ni tus datos personales.",
    },
  );

  return instance.getAsBuffer();
}
