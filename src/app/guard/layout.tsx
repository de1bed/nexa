import { GuardShell } from "@/components/guard-shell";
import { requirePortalRole } from "@/lib/server/session";
export default async function Layout({ children }: LayoutProps<"/guard">) {
  await requirePortalRole(["superadmin", "admin", "guard"]);
  return <GuardShell>{children}</GuardShell>;
}
