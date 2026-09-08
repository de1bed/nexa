import { TeamInviteForm } from "@/components/team-invite-form";

export const metadata = { title: "Crear cuenta" };

export default async function Page({
  params,
}: PageProps<"/invite/[token]">) {
  const { token } = await params;
  return <TeamInviteForm token={token} />;
}
