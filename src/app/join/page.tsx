import { JoinForm } from "@/components/join-form";
import { Brand } from "@/components/brand";
import { createServerSupabase } from "@/lib/server/supabase";
import { redirect } from "next/navigation";

export const metadata = { title: "Unirse a una organización" };

export default async function JoinPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  const db = await createServerSupabase();
  const { data: { user } } = await db.auth.getUser();
  
  if (!user) redirect("/login?redirect=/join");
  
  const { code } = await searchParams;

  return (
    <main className="min-h-screen bg-[#f4f7fb]">
      <header className="safe-top border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-15 max-w-lg items-center justify-center px-5">
          <Brand />
        </div>
      </header>

      <div className="mx-auto max-w-lg px-4 py-10">
        <div className="rounded-[26px] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <h1 className="text-2xl font-semibold tracking-tight">
            Unirse a una organización
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Ingresa el código que te compartió tu administrador para unirte a su equipo.
          </p>
          <JoinForm initialCode={code} />
        </div>
      </div>
    </main>
  );
}
