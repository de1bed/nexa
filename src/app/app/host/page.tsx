import { HostDashboard } from "@/components/host-dashboard";
import { requirePortalRole } from "@/lib/server/session";

export const metadata = { title: "Mi resumen" };

export default async function Page() {
  await requirePortalRole(["host"]);
  return <HostDashboard />;
}
