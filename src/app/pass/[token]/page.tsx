import { cookies } from "next/headers";
import { PublicPass } from "@/components/public-pass";
import { isKnownDemoToken } from "@/lib/demo-public";
import { DEMO_COOKIE } from "@/lib/session-constants";

export default async function Page(props: PageProps<"/pass/[token]">) {
  const { token } = await props.params;
  const demo = (await cookies()).get(DEMO_COOKIE)?.value === "1";
  return <PublicPass token={token} sandbox={demo || isKnownDemoToken(token)} />;
}
