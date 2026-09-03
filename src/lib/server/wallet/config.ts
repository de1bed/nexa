import "server-only";

/**
 * Credenciales de las carteras del teléfono.
 *
 * Ambas integraciones son opcionales: si faltan credenciales, la interfaz
 * simplemente no ofrece el botón. Nada del recorrido depende de ellas.
 *
 * Los certificados se guardan en base64 para que quepan en una variable de
 * entorno sin saltos de línea que se corrompan al copiarlos.
 */

function decode(value?: string) {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  // Se acepta tanto el PEM literal como su versión en base64.
  return trimmed.includes("-----BEGIN")
    ? trimmed
    : Buffer.from(trimmed, "base64").toString("utf8");
}

export type AppleWalletConfig = {
  teamIdentifier: string;
  passTypeIdentifier: string;
  organizationName: string;
  signerCert: string;
  signerKey: string;
  signerKeyPassphrase?: string;
  wwdr: string;
};

export function appleWalletConfig(): AppleWalletConfig | null {
  const teamIdentifier = process.env.APPLE_WALLET_TEAM_ID;
  const passTypeIdentifier = process.env.APPLE_WALLET_PASS_TYPE_ID;
  const signerCert = decode(process.env.APPLE_WALLET_CERT);
  const signerKey = decode(process.env.APPLE_WALLET_KEY);
  const wwdr = decode(process.env.APPLE_WALLET_WWDR);

  if (
    !teamIdentifier ||
    !passTypeIdentifier ||
    !signerCert ||
    !signerKey ||
    !wwdr
  )
    return null;

  return {
    teamIdentifier,
    passTypeIdentifier,
    organizationName: process.env.APPLE_WALLET_ORG_NAME ?? "NEXA VISIT",
    signerCert,
    signerKey,
    signerKeyPassphrase: process.env.APPLE_WALLET_KEY_PASSPHRASE || undefined,
    wwdr,
  };
}

export type GoogleWalletConfig = {
  issuerId: string;
  clientEmail: string;
  privateKey: string;
  classSuffix: string;
};

export function googleWalletConfig(): GoogleWalletConfig | null {
  const issuerId = process.env.GOOGLE_WALLET_ISSUER_ID;
  const clientEmail = process.env.GOOGLE_WALLET_CLIENT_EMAIL;
  // La llave de una cuenta de servicio trae "\n" escapados al pasar por env.
  const privateKey = process.env.GOOGLE_WALLET_PRIVATE_KEY?.replace(
    /\\n/g,
    "\n",
  );

  if (!issuerId || !clientEmail || !privateKey) return null;

  return {
    issuerId,
    clientEmail,
    privateKey,
    classSuffix: process.env.GOOGLE_WALLET_CLASS_SUFFIX ?? "nexa_visit_pass",
  };
}

/** Qué carteras puede ofrecer la instalación actual. */
export function walletAvailability() {
  return {
    apple: appleWalletConfig() !== null,
    google: googleWalletConfig() !== null,
  };
}
