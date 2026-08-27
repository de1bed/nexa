import { Reports } from "@/components/reports";
import { requirePortalRole } from "@/lib/server/session";
export default async function Page() {
  await requirePortalRole(["superadmin", "admin"]);
  return <Reports />;
}
