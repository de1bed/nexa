import { VisitDetail } from "@/components/visit-detail";
import { requirePortalRole } from "@/lib/server/session";

export default async function Page(props: PageProps<"/app/visits/[id]">) {
  await requirePortalRole(["superadmin", "admin", "host"]);
  const { id } = await props.params;
  return <VisitDetail id={id} />;
}
