import "server-only";
import { createHash, randomBytes, randomInt } from "node:crypto";
import { appUrl } from "@/lib/config";
import { requestOrigin } from "./rate-limit";
import { createAdminClient } from "./supabase-admin";

/**
 * QR de autorregistro: un punto por sede con un token (va en el QR impreso) y
 * un código de 4 dígitos (va impreso debajo). Los intentos fallidos se cuentan
 * en Postgres con `walkin_verify`, no en memoria.
 */

export const LOGO_BUCKET = "organization-logos";

export function newWalkinToken() {
  return randomBytes(24).toString("base64url");
}

/** Código de 4 dígitos distinto del anterior. */
export function newWalkinCode(previous?: string) {
  let code = previous ?? "";
  while (code === (previous ?? "")) code = String(randomInt(0, 10000)).padStart(4, "0");
  return code;
}

export function walkinUrl(token: string) {
  return `${appUrl()}/entrada/${token}`;
}

/**
 * Identidad del cliente para contar intentos. Se guarda solo el hash: la IP
 * en claro no se persiste.
 */
export function walkinClientHash(request: Request) {
  const salt = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "nexa-walkin";
  return createHash("sha256")
    .update(`${salt}:${requestOrigin(request)}`)
    .digest("hex");
}

export type WalkinVerification =
  | { state: "ok"; pointId: string; organizationId: string; locationId: string }
  | { state: "invalid" }
  | { state: "wrong_code"; attemptsLeft: number }
  | { state: "locked"; retryAfter: number };

export async function verifyWalkin(
  token: string,
  code: string,
  request: Request,
): Promise<WalkinVerification> {
  const { data, error } = await createAdminClient().rpc("walkin_verify", {
    p_token: token,
    p_code: code,
    p_client: walkinClientHash(request),
  });
  if (error || !data) return { state: "invalid" };
  return data as WalkinVerification;
}

/** URL pública del logo de la empresa, si tiene. */
export function logoPublicUrl(path?: string | null) {
  if (!path) return null;
  const { data } = createAdminClient().storage.from(LOGO_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

export type WalkinPointView = {
  id: string;
  locationId: string;
  url: string;
  code: string;
  active: boolean;
  tokenRotatedAt: string;
  codeRotatedAt: string;
};

export type PointRow = {
  id: string;
  location_id: string;
  public_token: string;
  access_code: string;
  active: boolean;
  token_rotated_at: string;
  code_rotated_at: string;
};

export const pointColumns =
  "id,location_id,public_token,access_code,active,token_rotated_at,code_rotated_at";

export function toView(row: PointRow): WalkinPointView {
  return {
    id: row.id,
    locationId: row.location_id,
    url: walkinUrl(row.public_token),
    code: row.access_code,
    active: row.active,
    tokenRotatedAt: row.token_rotated_at,
    codeRotatedAt: row.code_rotated_at,
  };
}
