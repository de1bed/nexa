"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { Brand } from "./brand";
import { roleHome } from "@/lib/config";
import type { MemberRole } from "@/lib/domain";

type Gate = {
  state?: string;
  organizationName?: string;
  organizationId?: string;
  role?: MemberRole;
  platformAdmin?: boolean;
};

export function AccessHold({ initial }: { initial: Gate }) {
  const router = useRouter();
  const [gate, setGate] = useState(initial);

  useEffect(() => {
    let active = true;
    async function tick() {
      const response = await fetch("/api/access/status", { cache: "no-store" });
      if (!response.ok || !active) return;
      const payload = (await response.json()) as Gate;
      setGate(payload);
      if (payload.platformAdmin && payload.state !== "active") {
        router.push("/platform");
        router.refresh();
        return;
      }
      if (payload.state === "active" && payload.organizationId && payload.role) {
        await fetch("/api/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ organizationId: payload.organizationId }),
        });
        router.push(roleHome[payload.role]);
        router.refresh();
      }
    }
    const id = window.setInterval(() => void tick(), 2000);
    return () => {
      active = false;
      window.clearInterval(id);
    };
  }, [router]);

  const pending = gate.state === "pending";
  const rejected = gate.state === "rejected";

  return (
    <main className="safe-top grid min-h-screen place-items-center bg-[#f4f7fb] px-5 py-10">
      <div className="w-full max-w-md rounded-[26px] border border-slate-200 bg-white p-6 text-center sm:p-8">
        <Brand />
        <span className="mx-auto mt-8 grid size-14 place-items-center rounded-full bg-[#10cfc9]/15 text-[#0d9d99]">
          <Loader2 className={pending ? "animate-spin" : ""} size={22} />
        </span>
        <h1 className="mt-5 text-2xl font-semibold tracking-[-.03em]">
          {rejected ? "Tu solicitud no fue aceptada" : "Tu acceso está en espera"}
        </h1>
        <p className="mt-3 text-[15px] leading-6 text-slate-500">
          {pending
            ? `${gate.organizationName ?? "Tu administrador"} tiene que recibirte para que puedas usar la plataforma. En cuanto te acepte, entras solo. Mientras tanto no puedes hacer nada más. Si urge, habla con tu asesor.`
            : rejected
              ? "Habla con tu asesor o con el administrador de la empresa. Puedes volver a solicitar el acceso con la misma clave."
              : "Para entrar necesitas la clave de tu empresa. Sin esa solicitud no hay acceso."}
        </p>
        {!pending && (
          <Link href="/solicitar" className="mt-6 inline-block text-sm font-semibold text-blue-600">
            Solicitar acceso
          </Link>
        )}
      </div>
    </main>
  );
}
