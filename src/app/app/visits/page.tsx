import { VisitsTable } from "@/components/visits-table";
import { requirePortalRole } from "@/lib/server/session";
export default async function Page() {
  const context = await requirePortalRole(["superadmin", "admin", "host"]);
  return <VisitsTable hostOnly={context.selected?.role === "host"} />;
}
