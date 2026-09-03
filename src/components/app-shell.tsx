"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Route } from "next";
import {
  BarChart3,
  Building2,
  CalendarDays,
  LayoutDashboard,
  MapPin,
  Plus,
  Settings,
  UserRoundCheck,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Brand } from "./brand";
import { SessionExit } from "./session-exit";
import { cn, Avatar } from "./ui";
import { useWorkspace } from "./workspace-provider";
import { roleLabels } from "@/lib/domain";

type NavItem = { href: Route; label: string; short: string; icon: LucideIcon };

const adminNav = [
  { href: "/app/dashboard", label: "Resumen", short: "Resumen", icon: LayoutDashboard },
  { href: "/app/visits", label: "Visitas", short: "Visitas", icon: CalendarDays },
  { href: "/app/people-on-site", label: "Personas dentro", short: "Dentro", icon: UserRoundCheck },
  { href: "/app/reports", label: "Reportes", short: "Reportes", icon: BarChart3 },
] satisfies NavItem[];

const adminSecondary = [
  { href: "/app/team", label: "Equipo", short: "Equipo", icon: Users },
  { href: "/app/locations", label: "Ubicaciones", short: "Sedes", icon: MapPin },
  { href: "/app/settings", label: "Configuración", short: "Ajustes", icon: Settings },
] satisfies NavItem[];

const hostNav = [
  { href: "/app/host", label: "Mi resumen", short: "Inicio", icon: LayoutDashboard },
  { href: "/app/visits", label: "Mis visitas", short: "Visitas", icon: CalendarDays },
] satisfies NavItem[];

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { viewer, organization } = useWorkspace();
  const isHost = viewer.role === "host";
  const primary = isHost ? hostNav : adminNav;
  const secondary = isHost ? [] : adminSecondary;
  const dock = isHost ? hostNav : [...adminNav].slice(0, 4);

  return (
    <div className="min-h-screen bg-[#f4f7fb] text-[#071426]">
      {/* Encabezado móvil */}
      <header className="safe-top sticky top-0 z-30 border-b border-slate-200 bg-white/85 backdrop-blur-lg lg:hidden">
        <div className="flex h-15 items-center justify-between px-4">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#071426] text-white">
              <Building2 size={17} />
            </span>
            <div className="min-w-0">
              <p className="truncate text-[15px] font-semibold leading-tight">
                {organization.name}
              </p>
              <p className="text-[11px] leading-tight text-slate-500">
                {roleLabels[viewer.role]} · {viewer.name.split(" ")[0]}
              </p>
            </div>
          </div>
          <SessionExit compact />
        </div>
      </header>

      {/* Barra lateral de escritorio */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-slate-200 bg-white p-5 lg:flex">
        <Brand />
        <div className="mt-7 flex items-center gap-3 rounded-2xl bg-slate-50 p-3">
          <Avatar name={viewer.name} size={38} tone="dark" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{organization.name}</p>
            <p className="truncate text-xs text-slate-500">
              {roleLabels[viewer.role]}
            </p>
          </div>
        </div>

        <nav className="mt-7 flex-1 space-y-1">
          {primary.map((item) => (
            <NavLink key={item.href} item={item} active={isActive(pathname, item.href)} />
          ))}
          {secondary.length > 0 && (
            <>
              <p className="px-3 pb-2 pt-6 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Organización
              </p>
              {secondary.map((item) => (
                <NavLink
                  key={item.href}
                  item={item}
                  active={isActive(pathname, item.href)}
                />
              ))}
            </>
          )}
        </nav>

        <SessionExit />
      </aside>

      <main className="pb-dock lg:pb-0 lg:pl-64">
        <div className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
          {children}
        </div>
      </main>

      {/* Acceso rápido y barra inferior en móvil */}
      <Link
        href="/app/visits/new"
        aria-label="Nueva invitación"
        className="fixed bottom-[calc(78px+env(safe-area-inset-bottom))] right-4 z-30 grid size-14 place-items-center rounded-2xl bg-[#10cfc9] text-[#043b39] shadow-[0_18px_38px_-14px_#10cfc9] transition active:scale-95 lg:hidden"
      >
        <Plus size={26} />
      </Link>

      <nav className="safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 backdrop-blur-lg lg:hidden">
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
                {item.short}
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
            {isHost ? "Invitar" : "Ajustes"}
          </Link>
        </div>
      </nav>
    </div>
  );
}

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
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
      {item.label}
    </Link>
  );
}
