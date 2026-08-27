import { InvitationForm } from "@/components/invitation-form";
import { requirePortalRole } from "@/lib/server/session";
export default async function Page() {
  await requirePortalRole(["superadmin", "admin", "host"]);
  return <InvitationForm />;
}
