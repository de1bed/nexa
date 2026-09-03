import { Dashboard } from "@/components/dashboard";
import { requirePortalRole } from "@/lib/server/session";

export const metadata = { title: "Resumen" };

export default async function Page() {
  await requirePortalRole(["superadmin", "admin"]);
  return <Dashboard />;
}
