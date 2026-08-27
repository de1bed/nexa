"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { createClient, hasSupabaseConfig } from "@/lib/supabase/client";

export function SessionExit({ dark = false, compact = false }: { dark?: boolean; compact?: boolean }) {
  const router = useRouter();
  async function exit() {
    if (hasSupabaseConfig() && process.env.NEXT_PUBLIC_DEMO_MODE === "false")
      await createClient().auth.signOut();
    document.cookie = "nexa-demo-role=; path=/; max-age=0; samesite=lax";
    router.replace("/login");
  }
  return <button onClick={exit} className={`flex items-center justify-center gap-2 rounded-xl text-sm font-medium transition ${compact ? "size-9" : "h-10 w-full"} ${dark ? "bg-white/10 text-white hover:bg-white/15" : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`} aria-label={compact ? "Cerrar sesión" : undefined}><LogOut size={16}/>{!compact && "Cambiar perfil / salir"}</button>;
}
