import { GuardShell } from "@/components/guard-shell";
import { WorkspaceProvider } from "@/components/workspace-provider";
import { requirePortalRole } from "@/lib/server/session";

export default async function Layout({ children }: LayoutProps<"/guard">) {
  const context = await requirePortalRole(["superadmin", "admin", "guard"]);
  return (
    <WorkspaceProvider
      viewer={{ id: context.userId, name: context.displayName, role: context.role }}
      organization={{ id: context.organizationId, name: context.organizationName }}
    >
      <GuardShell>{children}</GuardShell>
    </WorkspaceProvider>
  );
}
