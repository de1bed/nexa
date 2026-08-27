"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Building2,
  CalendarDays,
  ChevronDown,
  LayoutDashboard,
  MapPin,
  Menu,
  Settings,
  Users,
  UserRoundCheck,
  X,
} from "lucide-react";
import { useState } from "react";
import { Brand } from "./brand";
import type { MemberRole } from "@/lib/domain";
const nav = [
  { href: "/app/dashboard", label: "Resumen", icon: LayoutDashboard },
  { href: "/app/visits", label: "Visitas", icon: CalendarDays },
  {
    href: "/app/people-on-site",
    label: "Personas dentro",
    icon: UserRoundCheck,
  },
  { href: "/app/reports", label: "Reportes", icon: BarChart3 },
  { href: "/app/team", label: "Equipo", icon: Users },
  { href: "/app/locations", label: "Ubicaciones", icon: MapPin },
  { href: "/app/settings", label: "Configuración", icon: Settings },
];
export function AppShell({ children, role }: { children: React.ReactNode; role: MemberRole }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const visibleNav = role === "host" ? nav.filter((item) => ["/app/dashboard", "/app/visits"].includes(item.href)) : nav;
  return (
    <div className="min-h-screen bg-[#f7f9fc] text-[#071426]">
      <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-slate-200 bg-white/90 px-5 backdrop-blur lg:hidden">
        <Brand />
        <button
          aria-label="Abrir menú"
          onClick={() => setOpen(!open)}
          className="rounded-lg p-2 hover:bg-slate-100"
        >
          {open ? <X /> : <Menu />}
        </button>
      </header>
      <aside
        className={`fixed inset-y-0 left-0 z-30 w-64 border-r border-slate-200 bg-white p-5 transition-transform lg:translate-x-0 ${open ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className="mb-8 hidden lg:block">
          <Brand />
        </div>
        <div className="mb-7 flex items-center gap-3 rounded-xl bg-slate-50 p-3">
          <span className="grid size-9 place-items-center rounded-lg bg-[#071426] text-white">
            <Building2 size={17} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">Nova Logistics</p>
            <p className="text-xs text-slate-500">{role === "host" ? "Anfitrión" : "Administrador"}</p>
          </div>
          <ChevronDown size={14} />
        </div>
        <nav className="space-y-1">
          {visibleNav.map((item) => {
            const active = path.startsWith(item.href);
            return (
              <Link
                onClick={() => setOpen(false)}
                key={item.href}
                href={item.href as never}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${active ? "bg-[#071426] text-white shadow-sm" : "text-slate-600 hover:bg-slate-100 hover:text-[#071426]"}`}
              >
                <item.icon size={18} />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="absolute bottom-5 left-5 right-5 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-800">
          MVP demostrativo. Revisión legal requerida antes de producción.
        </div>
      </aside>
      <main className="lg:pl-64">
        <div className="mx-auto max-w-[1500px] p-5 sm:p-8 lg:p-10">
          {children}
        </div>
      </main>
      {open && (
        <button
          aria-label="Cerrar menú"
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-20 bg-slate-900/20 lg:hidden"
        />
      )}
    </div>
  );
}
