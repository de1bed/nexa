import { GuardShell } from "@/components/guard-shell";
import { WorkspaceProvider } from "@/components/workspace-provider";
import { requirePortalRole } from "@/lib/server/session";
import { cookies } from "next/headers";
import { STATION_BOOTH_COOKIE } from "@/lib/session-constants";

export default async function Layout({ children }: LayoutProps<"/guard">) {
  const context = await requirePortalRole(["superadmin", "admin", "guard"]);
  const lockedBoothId = (await cookies()).get(STATION_BOOTH_COOKIE)?.value;
  return (
    <WorkspaceProvider
      sandbox={!context.live}
      lockedBoothId={lockedBoothId}
      viewer={{ id: context.userId, name: context.displayName, role: context.role }}
      organization={{ id: context.organizationId, name: context.organizationName }}
    >
      <GuardShell>{children}</GuardShell>
    </WorkspaceProvider>
  );
}
