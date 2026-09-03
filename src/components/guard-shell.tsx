"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Route } from "next";
import { History, PenLine, ScanLine, Users } from "lucide-react";
import { Brand } from "./brand";
import { SessionExit } from "./session-exit";
import { cn } from "./ui";
import { useWorkspace } from "./workspace-provider";

const nav: Array<{ href: Route; label: string; icon: typeof ScanLine }> = [
  { href: "/guard/scan", label: "Escanear", icon: ScanLine },
  { href: "/guard/manual", label: "Manual", icon: PenLine },
  { href: "/guard/inside", label: "Dentro", icon: Users },
  { href: "/guard/history", label: "Bitácora", icon: History },
];

/** Portal de caseta: contraste alto, objetivos grandes y una sola columna. */
export function GuardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { visits, organization, viewer } = useWorkspace();
  const inside = visits.filter((visit) => visit.status === "checked_in").length;

  return (
    <div className="dark-panel min-h-screen text-white">
      <header className="safe-top sticky top-0 z-30 border-b border-white/10 bg-[#071426]/85 backdrop-blur-lg">
        <div className="mx-auto flex h-15 max-w-3xl items-center justify-between px-4">
          <Brand dark />
          <div className="flex items-center gap-2">
            <span className="hidden items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-[11px] font-medium sm:flex">
              <span className="size-1.5 rounded-full bg-emerald-400" />
              {organization.name}
            </span>
            <span className="rounded-full bg-white/10 px-3 py-1.5 text-[11px] font-medium">
              {inside} dentro
            </span>
            <SessionExit dark compact />
          </div>
        </div>
      </header>

      <main className="pb-dock mx-auto max-w-3xl px-4 pt-6 sm:px-6">
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
                aria-label={item.label}
                className={cn(
                  "flex min-h-16 flex-col items-center justify-center gap-1 text-[10px] font-medium transition",
                  active ? "text-[#10cfc9]" : "text-slate-400",
                )}
              >
                <item.icon size={22} strokeWidth={active ? 2.4 : 1.9} />
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>

      <span className="sr-only">Sesión de {viewer.name}</span>
    </div>
  );
}
