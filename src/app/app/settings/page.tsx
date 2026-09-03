import { SettingsPage } from "@/components/settings-pages";
import { requirePortalRole } from "@/lib/server/session";

export const metadata = { title: "Configuración" };

export default async function Page() {
  await requirePortalRole(["superadmin", "admin"]);
  return <SettingsPage />;
}
