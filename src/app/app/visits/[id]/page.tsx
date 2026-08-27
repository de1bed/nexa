import { VisitDetail } from "@/components/visit-detail";
import { requirePortalRole } from "@/lib/server/session";
export default async function Page(props: PageProps<"/app/visits/[id]">) {
  const context = await requirePortalRole(["superadmin", "admin", "host"]);
  const { id } = await props.params;
  return <VisitDetail id={id} hostOnly={context.selected?.role === "host"} />;
}
