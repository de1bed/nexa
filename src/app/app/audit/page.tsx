import { AuditLog } from "@/components/audit-log";
import { requirePortalRole } from "@/lib/server/session";

export const metadata = { title: "Cambios" };

export default async function Page() {
  await requirePortalRole(["superadmin", "admin"]);
  return <AuditLog />;
}
