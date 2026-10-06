import { WalkinEntry } from "@/components/walkin-entry";

export const metadata = { title: "Registro en recepción" };

export default async function Page(props: PageProps<"/entrada/[token]">) {
  const { token } = await props.params;
  return <WalkinEntry token={token} />;
}
