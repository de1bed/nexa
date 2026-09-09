import { PeopleAdmin } from "@/components/people-admin";
import { requirePortalRole } from "@/lib/server/session";

export const metadata = { title: "Personas dentro" };

export default async function Page() {
  await requirePortalRole(["superadmin", "admin", "host"]);
  return <PeopleAdmin />;
}
