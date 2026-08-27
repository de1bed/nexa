import { VisitDetail } from "@/components/visit-detail";
export default async function Page(props: PageProps<"/app/visits/[id]">) {
  const { id } = await props.params;
  return <VisitDetail id={id} />;
}
