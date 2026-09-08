import "server-only";
import { createAdminClient } from "./supabase-admin";
import {
  sendTeamInviteEmail,
  type DeliveryResult,
} from "./email";
import { appUrl } from "@/lib/config";
import { randomToken, sha256 } from "@/lib/security";
import { roleLabels, type MemberRole } from "@/lib/domain";

const INVITE_DAYS = 7;

export async function issueTeamInvite(input: {
  organizationId: string;
  organizationName: string;
  inviterId: string;
  inviterName: string;
  profileId: string;
  email: string;
  fullName: string;
  role: MemberRole;
}): Promise<{ token: string; inviteUrl: string; delivery: DeliveryResult }> {
  const admin = createAdminClient();
  const token = randomToken(32);
  const tokenHash = await sha256(token);
  const expiresAt = new Date(
    Date.now() + INVITE_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();

  await admin
    .from("team_invitations")
    .update({ revoked_at: new Date().toISOString() })
    .eq("organization_id", input.organizationId)
    .eq("profile_id", input.profileId)
    .is("accepted_at", null)
    .is("revoked_at", null);

  const { error } = await admin.from("team_invitations").insert({
    organization_id: input.organizationId,
    profile_id: input.profileId,
    invited_by: input.inviterId,
    email: input.email,
    role: input.role,
    token_hash: tokenHash,
    token_hint: `••••${token.slice(-4)}`,
    expires_at: expiresAt,
  });
  if (error) throw error;

  const inviteUrl = `${appUrl()}/invite/${token}`;

  let delivery: DeliveryResult;
  try {
    delivery = await sendTeamInviteEmail({
      to: input.email,
      fullName: input.fullName,
      inviterName: input.inviterName,
      organizationName: input.organizationName,
      roleLabel: roleLabels[input.role],
      actionUrl: inviteUrl,
      idempotencyKey: `team-invite/${input.profileId}/${tokenHash.slice(0, 24)}`,
    });
  } catch (reason) {
    console.error("Team invite email failed", reason);
    delivery = { status: "failed" };
  }

  await admin
    .from("organization_members")
    .update({ invite_delivery: delivery.status })
    .eq("organization_id", input.organizationId)
    .eq("profile_id", input.profileId);

  return { token, inviteUrl, delivery };
}
