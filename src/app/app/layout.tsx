import { AppShell } from "@/components/app-shell";
import { requirePortalRole } from "@/lib/server/session";
export default async function Layout({ children }: LayoutProps<"/app">) {
  const context = await requirePortalRole(["superadmin", "admin", "host"]);
  return (
    <AppShell role={context?.selected?.role ?? "admin"}>{children}</AppShell>
  );
}
