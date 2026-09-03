import { Reports } from "@/components/reports";
import { requirePortalRole } from "@/lib/server/session";

export const metadata = { title: "Reportes" };

export default async function Page() {
  await requirePortalRole(["superadmin", "admin"]);
  return <Reports />;
}
