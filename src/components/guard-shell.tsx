"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft, History, PenLine, ScanLine, Users } from "lucide-react";
import { Brand } from "./brand";
import { SessionExit } from "./session-exit";
import { LanguageSwitcher } from "./language-switcher";
import { cn } from "./ui";
import { DemoBanner } from "./demo-banner";
import { useWorkspace } from "./workspace-provider";
import { useI18n } from "./i18n-provider";

export function GuardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { visits, organization, viewer, live } = useWorkspace();
  const { t } = useI18n();
  const inside = visits.filter((visit) => visit.status === "checked_in").length;
  const isAdmin = viewer.role === "admin" || viewer.role === "superadmin";
  const nav = [
    { href: "/guard/scan" as const, labelKey: "nav.scan", icon: ScanLine },
    { href: "/guard/manual" as const, labelKey: "nav.manual", icon: PenLine },
    { href: "/guard/inside" as const, labelKey: "nav.insideShort", icon: Users },
    { href: "/guard/history" as const, labelKey: "nav.log", icon: History },
  ];

  return (
    <div className="dark-panel min-h-screen text-white">
      <header className="safe-top sticky top-0 z-30 border-b border-white/10 bg-[#071426]/85 backdrop-blur-lg">
        <div className="mx-auto flex h-15 max-w-3xl items-center justify-between px-4">
          {isAdmin ? (
            <Link 
              href="/app/dashboard"
              className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-slate-300 transition hover:bg-white/10 hover:text-white"
            >
              <ArrowLeft size={18} />
              <span className="hidden sm:inline">{t("nav.backToPanel")}</span>
            </Link>
          ) : (
            <Brand dark />
          )}
          <div className="flex items-center gap-2">
            {live ? (
              <Link
                href="/select-organization"
                onClick={() => {
                  void fetch("/api/session", { method: "DELETE" });
                }}
                className="hidden items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-[11px] font-medium transition hover:bg-white/15 sm:flex"
                title="Cambiar de empresa"
              >
                <span className="size-1.5 rounded-full bg-emerald-400" />
                {organization.name}
              </Link>
            ) : (
              <span className="hidden items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-[11px] font-medium sm:flex">
                <span className="size-1.5 rounded-full bg-emerald-400" />
                {organization.name}
              </span>
            )}
            <LanguageSwitcher dark compact />
            <span className="rounded-full bg-white/10 px-3 py-1.5 text-[11px] font-medium">
              {t("nav.insideCount", { n: inside })}
            </span>
            {!isAdmin && <SessionExit dark compact />}
          </div>
        </div>
      </header>

      <main className="pb-dock mx-auto max-w-3xl px-4 pt-6 sm:px-6">
        <DemoBanner dark />
        {children}
      </main>

      <nav className="safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-[#071426]/95 backdrop-blur-lg">
        <div className="mx-auto grid max-w-lg grid-cols-4">
          {nav.map((item) => {
            const active = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                aria-label={t(item.labelKey)}
                className={cn(
                  "flex min-h-16 flex-col items-center justify-center gap-1 text-[10px] font-medium transition",
                  active ? "text-[#10cfc9]" : "text-slate-400",
                )}
              >
                <item.icon size={22} strokeWidth={active ? 2.4 : 1.9} />
                {t(item.labelKey)}
              </Link>
            );
          })}
        </div>
      </nav>

      <span className="sr-only">{viewer.name}</span>
    </div>
  );
}
