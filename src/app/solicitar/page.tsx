import Link from "next/link";
import { redirect } from "next/navigation";
import { Brand } from "@/components/brand";
import { getSessionContext } from "@/lib/server/session";
import { isLiveMode, roleHome } from "@/lib/config";
import { isPlatformAdmin } from "@/lib/server/platform-admin";

export const metadata = { title: "Solicitar acceso" };

export default async function Page() {
  if (!isLiveMode()) redirect("/login");
  const context = await getSessionContext();
  if (!context.user) redirect("/login");
  const active = context.memberships.find((item) => item.serviceStatus === "active");
  if (active) redirect(roleHome[active.role]);
  if (
    await isPlatformAdmin(
      context.user.id,
      context.profile?.email ?? context.user.email ?? "",
    ).catch(() => false)
  )
    redirect("/platform");
  return (
    <main className="safe-top grid min-h-screen place-items-center bg-[#f4f7fb] px-5 py-10">
      <div className="w-full max-w-md rounded-[26px] border border-slate-200 bg-white p-6 text-center sm:p-8">
        <Brand />
        <h1 className="mt-8 text-2xl font-semibold tracking-[-.03em]">
          Necesitas una invitación
        </h1>
        <p className="mt-3 text-[15px] leading-6 text-slate-500">
          La clave de empresa ya no pide acceso. Entras cuando te llega el correo
          de invitación.
        </p>
        <Link href="/login" className="mt-6 inline-block text-sm font-semibold text-blue-600">
          Volver a entrar
        </Link>
      </div>
    </main>
  );
}
