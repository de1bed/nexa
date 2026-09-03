import { AppShell } from "@/components/app-shell";
import { WorkspaceProvider } from "@/components/workspace-provider";
import { requirePortalRole } from "@/lib/server/session";

export default async function Layout({ children }: LayoutProps<"/app">) {
  const context = await requirePortalRole(["superadmin", "admin", "host"]);
  return (
    <WorkspaceProvider
      viewer={{ id: context.userId, name: context.displayName, role: context.role }}
      organization={{ id: context.organizationId, name: context.organizationName }}
    >
      <AppShell>{children}</AppShell>
    </WorkspaceProvider>
  );
}
