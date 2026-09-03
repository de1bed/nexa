import { VisitsTable } from "@/components/visits-table";
import { requirePortalRole } from "@/lib/server/session";

export const metadata = { title: "Visitas" };

export default async function Page() {
  await requirePortalRole(["superadmin", "admin", "host"]);
  return <VisitsTable />;
}
