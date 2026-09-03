import { redirect } from "next/navigation";
import { roleHome } from "@/lib/config";
import { requirePortalRole } from "@/lib/server/session";

export default async function Page() {
  const context = await requirePortalRole(["superadmin", "admin", "host"]);
  redirect(roleHome[context.role]);
}
