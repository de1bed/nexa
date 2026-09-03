import { LocationsPage } from "@/components/settings-pages";
import { requirePortalRole } from "@/lib/server/session";

export const metadata = { title: "Ubicaciones" };

export default async function Page() {
  await requirePortalRole(["superadmin", "admin"]);
  return <LocationsPage />;
}
