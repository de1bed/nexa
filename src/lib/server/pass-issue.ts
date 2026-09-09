import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { createAdminClient } from "./supabase-admin";
import { appUrl } from "@/lib/config";
import { passValidityWindow } from "@/lib/pass-window";

export function passUrls(token: string) {
  return { passToken: token, passUrl: `${appUrl()}/pass/${token}` };
}

/** Ajusta pases ya emitidos: valen desde ahora y duran hasta un día después del fin. */
export async function healQrWindow(input: {
  visitId: string;
  startsAt: string;
  endsAt: string;
  validFrom: string;
  expiresAt: string;
}) {
  const now = new Date();
  const issuedAt =
    new Date(input.validFrom) > now ? now : new Date(input.validFrom);
  const desired = passValidityWindow({
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    issuedAt,
  });
  const patch: { valid_from?: string; expires_at?: string } = {};
  if (new Date(input.validFrom) > now) patch.valid_from = now.toISOString();
  if (new Date(input.expiresAt) < new Date(desired.expires_at))
    patch.expires_at = desired.expires_at;
  if (!patch.valid_from && !patch.expires_at)
    return { validFrom: input.validFrom, expiresAt: input.expiresAt };

  const { error } = await createAdminClient()
    .from("qr_tokens")
    .update(patch)
    .eq("visit_id", input.visitId)
    .is("revoked_at", null);
  if (error) throw error;

  return {
    validFrom: patch.valid_from ?? input.validFrom,
    expiresAt: patch.expires_at ?? input.expiresAt,
  };
}

/**
 * Devuelve el pase vigente para personal (anfitrión / admin).
 * El token en claro se guarda para poder mostrarlo y descargarlo sin correo.
 * `rotate` invalida el QR anterior y emite uno nuevo.
 */
export async function getOrIssueStaffPass(input: {
  visitId: string;
  organizationId: string;
  startsAt: string;
  endsAt: string;
  rotate?: boolean;
}) {
  const admin = createAdminClient();

  if (!input.rotate) {
    const { data } = await admin
      .from("qr_tokens")
      .select("public_token,valid_from,expires_at")
      .eq("visit_id", input.visitId)
      .is("revoked_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data?.public_token) {
      let validFrom = data.valid_from as string;
      let expiresAt = data.expires_at as string;
      try {
        const healed = await healQrWindow({
          visitId: input.visitId,
          startsAt: input.startsAt,
          endsAt: input.endsAt,
          validFrom,
          expiresAt,
        });
        validFrom = healed.validFrom;
        expiresAt = healed.expiresAt;
      } catch {
        // Se muestra el pase aunque no se haya podido alargar.
      }
      return {
        ...passUrls(data.public_token as string),
        validFrom,
        expiresAt,
      };
    }
  }

  const passToken = randomBytes(32).toString("base64url");
  const hash = createHash("sha256").update(passToken).digest("hex");
  const window = passValidityWindow({
    startsAt: input.startsAt,
    endsAt: input.endsAt,
  });

  const { error: revokeError } = await admin
    .from("qr_tokens")
    .update({ revoked_at: new Date().toISOString() })
    .eq("visit_id", input.visitId)
    .is("revoked_at", null);
  if (revokeError) throw revokeError;

  const { error } = await admin.from("qr_tokens").insert({
    organization_id: input.organizationId,
    visit_id: input.visitId,
    token_hash: hash,
    token_hint: `••••${passToken.slice(-4)}`,
    public_token: passToken,
    ...window,
  });
  if (error) throw error;

  return {
    ...passUrls(passToken),
    validFrom: window.valid_from,
    expiresAt: window.expires_at,
  };
}
