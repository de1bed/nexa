import { redirect } from "next/navigation";
import { PlatformConsole } from "@/components/platform-console";
import { getSessionContext } from "@/lib/server/session";
import { isLiveMode } from "@/lib/config";
import { isPlatformAdmin } from "@/lib/server/platform-admin";

export const metadata = { title: "Consola NEXA" };

export default async function Page() {
  if (!isLiveMode()) redirect("/login");
  const context = await getSessionContext();
  if (!context.user) redirect("/login");
  const allowed = await isPlatformAdmin(
    context.user.id,
    context.profile?.email ?? context.user.email ?? "",
  );
  if (!allowed) redirect("/espera");
  return (
    <main className="min-h-screen bg-[#f4f7fb] px-4 py-8 sm:px-8">
      <div className="mx-auto max-w-5xl">
        <PlatformConsole />
      </div>
    </main>
  );
}
