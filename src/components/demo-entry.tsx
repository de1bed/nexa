"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, QrCode, ShieldCheck, UserRound, Users } from "lucide-react";
import { Brand } from "./brand";
import { LanguageSwitcher } from "./language-switcher";
import { useI18n } from "./i18n-provider";
import { roleHome } from "@/lib/config";
import { createClient } from "@/lib/supabase/client";
import { DEMO_INVITE_TOKEN, DEMO_PASS_TOKEN, writeDemoSession } from "@/lib/demo-public";
import type { MemberRole } from "@/lib/domain";

const profiles: Array<{
  role: Exclude<MemberRole, "superadmin">;
  descKey: "login.adminDesc" | "login.hostDesc" | "login.guardDesc";
  icon: typeof Users;
}> = [
  { role: "admin", descKey: "login.adminDesc", icon: Users },
  { role: "host", descKey: "login.hostDesc", icon: UserRound },
  { role: "guard", descKey: "login.guardDesc", icon: ShieldCheck },
];

export function DemoEntry() {
  const router = useRouter();
  const { t } = useI18n();

  async function enter(role: Exclude<MemberRole, "superadmin">) {
    try {
      await createClient().auth.signOut();
    } catch {
      // La demo no usa la sesión real.
    }
    try {
      await fetch("/api/session", { method: "DELETE" });
    } catch {
      // Si no había empresa elegida, la demo sigue.
    }
    writeDemoSession(role);
    router.push(roleHome[role]);
    router.refresh();
  }

  return (
    <main className="safe-top min-h-screen bg-[#f4f7fb] text-[#071426]">
      <nav className="mx-auto flex max-w-lg items-center justify-between px-5 py-5">
        <Brand />
        <LanguageSwitcher compact />
      </nav>
      <section className="mx-auto max-w-lg px-5 pb-16">
        <p className="text-sm font-semibold text-[#0d9d99]">{t("login.demoMode")}</p>
        <h1 className="mt-2 text-[32px] font-semibold leading-tight tracking-[-.035em]">
          {t("demo.title")}
        </h1>
        <p className="mt-3 text-[15px] leading-6 text-slate-500">{t("demo.lead")}</p>

        <div className="mt-8 space-y-3">
          <p className="text-sm font-semibold">{t("demo.pick")}</p>
          {profiles.map((profile) => (
            <button
              key={profile.role}
              type="button"
              onClick={() => enter(profile.role)}
              className="flex w-full items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 text-left transition active:scale-[.99] active:bg-slate-50"
            >
              <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-[#071426] text-white">
                <profile.icon size={22} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">{t(`roles.${profile.role}`)}</span>
                <span className="mt-0.5 block text-xs leading-5 text-slate-500">
                  {t(profile.descKey)}
                </span>
              </span>
              <ArrowRight size={19} className="shrink-0 text-slate-300" />
            </button>
          ))}
        </div>

        <div className="mt-8 space-y-3">
          <Link
            href={`/pass/${DEMO_PASS_TOKEN}`}
            className="flex items-center justify-center gap-2 rounded-2xl bg-[#071426] px-5 py-4 font-semibold text-white"
          >
            <QrCode size={18} />
            {t("demo.pass")}
          </Link>
          <Link
            href={`/visit/${DEMO_INVITE_TOKEN}`}
            className="flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 py-4 font-semibold"
          >
            {t("demo.register")}
          </Link>
          <p className="text-sm leading-6 text-slate-500">{t("demo.qrNote")}</p>
        </div>
      </section>
    </main>
  );
}
