"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Route } from "next";
import {
  BarChart3,
  CalendarDays,
  LayoutDashboard,
  MapPin,
  Plus,
  ScanLine,
  Settings,
  UserRoundCheck,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Brand } from "./brand";
import { SessionExit } from "./session-exit";
import { WorkspaceSwitcher } from "./workspace-switcher";
import { LanguageSwitcher } from "./language-switcher";
import { cn } from "./ui";
import { useWorkspace } from "./workspace-provider";
import { useI18n } from "./i18n-provider";

type NavItem = { href: Route; labelKey: string; shortKey: string; icon: LucideIcon };

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { viewer } = useWorkspace();
  const { t } = useI18n();
  const isHost = viewer.role === "host";
  const adminNav = [
    { href: "/app/dashboard", labelKey: "nav.summary", shortKey: "nav.summary", icon: LayoutDashboard },
    { href: "/app/visits", labelKey: "nav.visits", shortKey: "nav.visits", icon: CalendarDays },
    { href: "/app/people-on-site", labelKey: "nav.inside", shortKey: "nav.insideShort", icon: UserRoundCheck },
    { href: "/app/reports", labelKey: "nav.reports", shortKey: "nav.reports", icon: BarChart3 },
  ] satisfies NavItem[];
  const adminSecondary = [
    { href: "/app/team", labelKey: "nav.team", shortKey: "nav.team", icon: Users },
    { href: "/app/locations", labelKey: "nav.locations", shortKey: "nav.locations", icon: MapPin },
    { href: "/app/settings", labelKey: "nav.settings", shortKey: "nav.settingsShort", icon: Settings },
    { href: "/guard/scan", labelKey: "nav.booth", shortKey: "nav.boothShort", icon: ScanLine },
  ] satisfies NavItem[];
  const hostNav = [
    { href: "/app/host", labelKey: "nav.hostHome", shortKey: "nav.hostHomeShort", icon: LayoutDashboard },
    { href: "/app/visits", labelKey: "nav.hostVisits", shortKey: "nav.visits", icon: CalendarDays },
    { href: "/app/people-on-site", labelKey: "nav.hostInside", shortKey: "nav.insideShort", icon: UserRoundCheck },
    { href: "/app/reports", labelKey: "nav.hostReports", shortKey: "nav.reports", icon: BarChart3 },
  ] satisfies NavItem[];
  const primary = isHost ? hostNav : adminNav;
  const secondary = isHost ? [] : adminSecondary;
  const dock = isHost
    ? [hostNav[0], hostNav[1], hostNav[2]]
    : [
        adminNav[0],
        adminNav[1],
        { href: "/guard/scan" as Route, labelKey: "nav.boothShort", shortKey: "nav.boothShort", icon: ScanLine },
      ];

  function isActive(path: string, href: string) {
    return path === href || path.startsWith(`${href}/`);
  }

  return (
    <div className="min-h-screen bg-[#f4f7fb] text-[#071426]">
      {/* Encabezado móvil */}
      <header className="safe-top no-print sticky top-0 z-30 border-b border-slate-200 bg-white/85 backdrop-blur-lg lg:hidden">
        <div className="flex h-15 items-center justify-between gap-2 px-4">
          <WorkspaceSwitcher compact />
          <div className="flex items-center gap-2">
            <LanguageSwitcher compact />
            <SessionExit compact />
          </div>
        </div>
      </header>

      {/* Barra lateral de escritorio */}
      <aside className="no-print fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-slate-200 bg-white p-5 lg:flex">
        <Brand />
        <div className="mt-7">
          <WorkspaceSwitcher />
        </div>

        <nav className="mt-7 flex-1 space-y-1">
          {primary.map((item) => (
            <NavLink key={item.href} item={item} active={isActive(pathname, item.href)} label={t(item.labelKey)} />
          ))}
          {secondary.length > 0 && (
            <>
              <p className="px-3 pb-2 pt-6 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                {t("common.organization")}
              </p>
              {secondary.map((item) => (
                <NavLink
                  key={item.href}
                  item={item}
                  active={isActive(pathname, item.href)}
                  label={t(item.labelKey)}
                />
              ))}
            </>
          )}
        </nav>

        <div className="space-y-3">
          <LanguageSwitcher />
          <SessionExit />
        </div>
      </aside>

      <main className="pb-dock print:p-0 lg:pb-0 lg:pl-64 print:pl-0">
        <div className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 lg:px-10 lg:py-10 print:max-w-none print:px-0 print:py-0">
          {children}
        </div>
      </main>

      {/* Acceso rápido y barra inferior en móvil */}
      <Link
        href="/app/visits/new"
        aria-label={t("nav.newInvite")}
        className="no-print fixed bottom-[calc(78px+env(safe-area-inset-bottom))] right-4 z-30 grid size-14 place-items-center rounded-2xl bg-[#10cfc9] text-[#043b39] shadow-[0_18px_38px_-14px_#10cfc9] transition active:scale-95 lg:hidden"
      >
        <Plus size={26} />
      </Link>

      <nav className="safe-bottom no-print fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 backdrop-blur-lg lg:hidden">
        <div
          className="mx-auto grid max-w-lg"
          style={{ gridTemplateColumns: `repeat(${dock.length + 1}, minmax(0, 1fr))` }}
        >
          {dock.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-16 flex-col items-center justify-center gap-1 text-[10px] font-medium transition",
                  active ? "text-[#0d9d99]" : "text-slate-400",
                )}
              >
                <item.icon size={21} strokeWidth={active ? 2.4 : 1.9} />
                {t(item.shortKey)}
              </Link>
            );
          })}
          <Link
            href={isHost ? "/app/visits/new" : "/app/settings"}
            className={cn(
              "flex min-h-16 flex-col items-center justify-center gap-1 text-[10px] font-medium transition",
              isActive(pathname, isHost ? "/app/visits/new" : "/app/settings")
                ? "text-[#0d9d99]"
                : "text-slate-400",
            )}
          >
            {isHost ? <Plus size={21} /> : <Settings size={21} />}
            {isHost ? t("nav.invite") : t("nav.settingsShort")}
          </Link>
        </div>
      </nav>
    </div>
  );
}

function NavLink({
  item,
  active,
  label,
}: {
  item: NavItem;
  active: boolean;
  label: string;
}) {
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium transition",
        active
          ? "bg-[#071426] text-white"
          : "text-slate-600 hover:bg-slate-100 hover:text-[#071426]",
      )}
    >
      <item.icon size={18} />
      {label}
    </Link>
  );
}
