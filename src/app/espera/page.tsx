import { redirect } from "next/navigation";
import { AccessHold } from "@/components/access-hold";
import { getSessionContext } from "@/lib/server/session";
import { isLiveMode, roleHome } from "@/lib/config";
import { isPlatformAdmin } from "@/lib/server/platform-admin";

export const metadata = { title: "Acceso en espera" };

export default async function Page() {
  if (!isLiveMode()) redirect("/login");
  const context = await getSessionContext();
  if (!context.user) redirect("/login");

  const active = context.memberships.find((item) => item.serviceStatus === "active");
  if (active) redirect(roleHome[active.role]);

  const platform = await isPlatformAdmin(
    context.user.id,
    context.profile?.email ?? context.user.email ?? "",
  ).catch(() => false);
  if (platform) redirect("/platform");

  const { data } = await context.db.rpc("my_access_gate");
  const gate = (data ?? { state: "none" }) as {
    state?: string;
    organizationName?: string;
    organizationId?: string;
    role?: "admin" | "host" | "guard";
  };
  return <AccessHold initial={gate} />;
}
