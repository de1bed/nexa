import { PublicPass } from "@/components/public-pass";
export default async function Page(props: PageProps<"/pass/[token]">) { const { token } = await props.params; return <PublicPass token={token}/>; }
