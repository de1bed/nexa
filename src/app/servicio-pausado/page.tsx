import { redirect } from "next/navigation";
import { Brand } from "@/components/brand";
import { getSessionContext } from "@/lib/server/session";
import { isLiveMode, roleHome } from "@/lib/config";

export const metadata = { title: "Servicio en pausa" };

export default async function Page() {
  if (!isLiveMode()) redirect("/login");
  const context = await getSessionContext();
  if (!context.user) redirect("/login");
  const active = context.memberships.find((item) => item.serviceStatus === "active");
  if (active) redirect(roleHome[active.role]);
  if (context.memberships.length === 0) redirect("/espera");

  return (
    <main className="safe-top grid min-h-screen place-items-center bg-[#f4f7fb] px-5">
      <div className="w-full max-w-md rounded-[26px] border border-slate-200 bg-white p-8 text-center">
        <Brand />
        <h1 className="mt-8 text-2xl font-semibold">El servicio está en pausa</h1>
        <p className="mt-3 text-[15px] leading-6 text-slate-500">
          {context.memberships[0]?.organizationName ?? "Tu empresa"} no tiene el
          servicio activo. Habla con tu asesor de NEXA para reactivarlo. Tus datos
          siguen guardados.
        </p>
      </div>
    </main>
  );
}
