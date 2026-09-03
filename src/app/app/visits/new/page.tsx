import { InvitationForm } from "@/components/invitation-form";
import { requirePortalRole } from "@/lib/server/session";

export const metadata = { title: "Nueva invitación" };

export default async function Page() {
  await requirePortalRole(["superadmin", "admin", "host"]);
  return <InvitationForm />;
}
