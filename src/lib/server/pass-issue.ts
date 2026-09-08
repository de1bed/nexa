import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { createAdminClient } from "./supabase-admin";
import { appUrl } from "@/lib/config";

export function passUrls(token: string) {
  return { passToken: token, passUrl: `${appUrl()}/pass/${token}` };
}

function windowFor(startsAt: string, endsAt: string) {
  return {
    valid_from: new Date(
      new Date(startsAt).getTime() - 60 * 60000,
    ).toISOString(),
    expires_at: new Date(
      new Date(endsAt).getTime() + 12 * 3600000,
    ).toISOString(),
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
      .select("public_token")
      .eq("visit_id", input.visitId)
      .is("revoked_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data?.public_token) return passUrls(data.public_token as string);
  }

  const passToken = randomBytes(32).toString("base64url");
  const hash = createHash("sha256").update(passToken).digest("hex");
  const window = windowFor(input.startsAt, input.endsAt);

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

  return passUrls(passToken);
}
