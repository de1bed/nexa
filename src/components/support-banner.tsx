"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { SUPPORT_VIEW_COOKIE } from "@/lib/session-constants";
import { useWorkspace } from "./workspace-provider";

export function SupportBanner({ dark = false }: { dark?: boolean }) {
  const { live, organization } = useWorkspace();
  const router = useRouter();
  const [name, setName] = useState("");

  useEffect(() => {
    if (!live) {
      const on =
        typeof document !== "undefined" &&
        document.cookie.split(";").some((part) => part.trim().startsWith(`${SUPPORT_VIEW_COOKIE}=1`));
      setName(on ? organization.name : "");
      return;
    }
    let active = true;
    void fetch("/api/platform/support", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok || !active) return;
        const payload = (await response.json()) as {
          supporting?: boolean;
          organizationName?: string;
        };
        if (active) setName(payload.supporting ? payload.organizationName ?? organization.name : "");
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [live, organization.name]);

  if (!name) return null;

  async function leave() {
    if (!live) {
      document.cookie = `${SUPPORT_VIEW_COOKIE}=; path=/; max-age=0; samesite=lax`;
      router.push("/platform");
      return;
    }
    await fetch("/api/platform/support", { method: "DELETE" });
    router.push("/platform");
    router.refresh();
  }

  return (
    <div
      className={
        dark
          ? "mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#10cfc9]/40 bg-[#10cfc9]/10 px-4 py-3 text-sm text-white"
          : "mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#0d9d99]/30 bg-[#e7f8f7] px-4 py-3 text-sm text-[#043b39]"
      }
    >
      <p>
        Estás viendo <b>{name}</b> como su administrador. Lo que cambies aquí es lo que ellos ven.
      </p>
      <button
        type="button"
        onClick={() => void leave()}
        className={
          dark
            ? "rounded-xl bg-[#10cfc9] px-3 py-2 text-sm font-semibold text-[#043b39]"
            : "rounded-xl bg-[#071426] px-3 py-2 text-sm font-semibold text-white"
        }
      >
        Volver a la consola
      </button>
    </div>
  );
}
