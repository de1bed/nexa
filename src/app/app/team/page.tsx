import { TeamPage } from "@/components/settings-pages";
import { requirePortalRole } from "@/lib/server/session";

export const metadata = { title: "Equipo" };

export default async function Page() {
  await requirePortalRole(["superadmin", "admin"]);
  return <TeamPage />;
}
