import { redirect } from "next/navigation";
import { AccessRequestForm } from "@/components/access-request-form";
import { getSessionContext } from "@/lib/server/session";
import { isLiveMode, roleHome } from "@/lib/config";
import { isPlatformAdmin } from "@/lib/server/platform-admin";

export const metadata = { title: "Solicitar acceso" };

export default async function Page() {
  if (!isLiveMode()) redirect("/login");
  const context = await getSessionContext();
  if (!context.user) redirect("/login");
  const active = context.memberships.find((item) => item.serviceStatus === "active");
  if (active) redirect(roleHome[active.role]);
  if (
    await isPlatformAdmin(
      context.user.id,
      context.profile?.email ?? context.user.email ?? "",
    ).catch(() => false)
  )
    redirect("/platform");
  return <AccessRequestForm />;
}
