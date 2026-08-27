"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { History, PenLine, QrCode, Users } from "lucide-react";
import { Brand } from "./brand";
const nav = [
  { href: "/guard/scan", label: "Escanear", icon: QrCode },
  { href: "/guard/manual", label: "Manual", icon: PenLine },
  { href: "/guard/inside", label: "Dentro", icon: Users },
  { href: "/guard/history", label: "Historial", icon: History },
];
export function GuardShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  return (
    <div className="min-h-screen bg-[#071426] pb-24 text-white">
      <header className="sticky top-0 z-30 border-b border-white/10 bg-[#071426]/90 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-5 py-4">
          <Brand dark />
          <span className="flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs">
            <span className="size-2 rounded-full bg-emerald-400" />
            Recepción Norte
          </span>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-5 py-7">{children}</main>
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-[#071426]/95 px-3 pb-[env(safe-area-inset-bottom)] backdrop-blur">
        <div className="mx-auto grid max-w-3xl grid-cols-4">
          {nav.map((x) => (
            <Link
              key={x.href}
              href={x.href as never}
              className={`flex min-h-17 flex-col items-center justify-center gap-1 text-[11px] ${path.startsWith(x.href) ? "text-[#10cfc9]" : "text-slate-400"}`}
            >
              <x.icon size={21} />
              {x.label}
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}
