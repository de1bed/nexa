import { cookies } from "next/headers";
import { VisitorFlow } from "@/components/visitor-flow";
import { isKnownDemoToken } from "@/lib/demo-public";
import { DEMO_COOKIE } from "@/lib/session-constants";

export default async function Page(props: PageProps<"/visit/[publicToken]">) {
  const { publicToken } = await props.params;
  const demo = (await cookies()).get(DEMO_COOKIE)?.value === "1";
  return (
    <VisitorFlow token={publicToken} sandbox={demo || isKnownDemoToken(publicToken)} />
  );
}
