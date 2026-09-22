"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { createClient, isLiveMode } from "@/lib/supabase/client";
import { clearDemoSession, readDemoCookie } from "@/lib/demo-public";
import { cn } from "./ui";
import { useI18n } from "./i18n-provider";

export function SessionExit({
  dark = false,
  compact = false,
}: {
  dark?: boolean;
  compact?: boolean;
}) {
  const router = useRouter();
  const { t } = useI18n();

  async function exit() {
    if (readDemoCookie()) {
      clearDemoSession();
      router.replace("/demo");
      router.refresh();
      return;
    }
    if (isLiveMode()) {
      try {
        await fetch("/api/session", { method: "DELETE" });
      } catch {
        // La cookie de empresa se limpia en el servidor; si falla, igual cerramos Auth.
      }
      try {
        await createClient().auth.signOut();
      } catch {
        // Aunque falle el cierre remoto, la sesión local debe terminar.
      }
    }
    document.cookie = "nexa-role=; path=/; max-age=0; samesite=lax";
    router.replace("/login");
    router.refresh();
  }

  return (
    <button
      onClick={exit}
      aria-label={t("common.signOut")}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-xl text-sm font-medium transition active:scale-95",
        compact ? "size-10" : "h-11 w-full",
        dark
          ? "bg-white/10 text-white"
          : "border border-slate-200 bg-white text-slate-600",
      )}
    >
      <LogOut size={17} />
      {!compact && t("common.signOut")}
    </button>
  );
}
