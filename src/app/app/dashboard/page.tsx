import { Dashboard } from "@/components/dashboard";
import { requirePortalRole } from "@/lib/server/session";
export default async function Page() {
  await requirePortalRole(["superadmin", "admin"]);
  return <Dashboard />;
}
