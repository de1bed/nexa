import { randomBytes } from "node:crypto";

const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** Clave legible de empresa. No es una contraseña de usuario. */
export function createAccessKey() {
  const bytes = randomBytes(8);
  let body = "";
  for (let index = 0; index < 8; index += 1) {
    body += alphabet[bytes[index]! % alphabet.length];
  }
  return `NEXA-${body.slice(0, 4)}-${body.slice(4)}`;
}

export function normalizeAccessKey(value: string) {
  return value.trim().toUpperCase().replace(/\s+/g, "");
}
