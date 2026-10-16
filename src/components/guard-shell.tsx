"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  Building2,
  History,
  PenLine,
  ScanLine,
  Users,
} from "lucide-react";
import { Brand } from "./brand";
import { SessionExit } from "./session-exit";
import { LanguageSwitcher } from "./language-switcher";
import { cn } from "./ui";
import { DemoBanner } from "./demo-banner";
import { UpdatesBell } from "./updates-bell";
import { useWorkspace } from "./workspace-provider";
import { useI18n } from "./i18n-provider";

export function GuardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { visits, organization, viewer, live, lockedBoothId } = useWorkspace();
  const { t } = useI18n();
  const inside = visits.filter((visit) => visit.status === "checked_in").length;
  const isAdmin = viewer.role === "admin" || viewer.role === "superadmin";
  const [welcome, setWelcome] = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem("nexa-guard-welcome") !== "1") return;
    sessionStorage.removeItem("nexa-guard-welcome");
    setWelcome(true);
  }, []);
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
            <UpdatesBell dark teamHref={isAdmin} />
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
        {welcome && viewer.role === "guard" && (
          <div className="mb-5 rounded-3xl border border-[#10cfc9]/40 bg-[#10cfc9]/10 p-5">
            <p className="text-sm font-semibold text-[#10cfc9]">
              {t("guard.welcomeEyebrow")}
            </p>
            <h2 className="mt-1 text-2xl font-semibold tracking-[-.03em]">
              {viewer.name}
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              {t("guard.welcomeHint")}
            </p>
            <button
              type="button"
              onClick={() => setWelcome(false)}
              className="mt-4 rounded-xl bg-[#10cfc9] px-4 py-2.5 text-sm font-semibold text-[#043b39]"
            >
              {t("guard.welcomeStart")}
            </button>
          </div>
        )}
        <StationPicker />
        {!pathname.startsWith("/guard/switch") && (
          <div className="mb-5 flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[.04] px-3 py-3">
            <p className="min-w-0 truncate text-sm text-slate-300">
              <span className="text-slate-500">{t("guard.welcomeEyebrow")}</span>
              <span className="ml-2 font-semibold text-white">{viewer.name}</span>
            </p>
            <Link
              href="/guard/switch"
              className="shrink-0 rounded-xl bg-[#10cfc9] px-3 py-2 text-sm font-semibold text-[#043b39]"
            >
              {t("guard.switchGuard")}
            </Link>
          </div>
        )}
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

/**
 * Caseta en la que trabaja este dispositivo. Aparece cuando hay más de una
 * caseta, o —si todavía no hay casetas dadas de alta— más de una sede.
 */
function StationPicker() {
  const { locations, booths, boothId, setBoothId, stationId, setStationId, lockedBoothId } =
    useWorkspace();
  const { t } = useI18n();
  if (lockedBoothId) {
    const booth = booths.find((item) => item.id === lockedBoothId);
    return (
      <div className="mb-5 rounded-2xl border border-white/10 bg-white/[.04] p-3">
        <div className="flex items-center gap-3">
          <Building2 size={18} className="shrink-0 text-[#10cfc9]" />
          <span className="shrink-0 text-xs font-semibold uppercase tracking-wide text-slate-400">
            {t("guard.station")}
          </span>
          <span className="min-w-0 flex-1 truncate text-sm font-semibold">
            {booth?.name ?? t("guard.station")}
          </span>
        </div>
        <p className="mt-2 text-xs leading-5 text-slate-400">{t("guard.lockedBooth")}</p>
      </div>
    );
  }
  const activeBooths = booths.filter((booth) => booth.active);
  const choosingBooth = activeBooths.length > 0;
  if (choosingBooth ? activeBooths.length < 2 : locations.length < 2) return null;
  const selected = choosingBooth ? Boolean(boothId) : Boolean(stationId);

  return (
    <div
      className={cn(
        "mb-5 rounded-2xl border p-3",
        selected
          ? "border-white/10 bg-white/[.04]"
          : "border-amber-400/30 bg-amber-400/10",
      )}
    >
      <label className="flex items-center gap-3">
        <Building2 size={18} className="shrink-0 text-[#10cfc9]" />
        <span className="shrink-0 text-xs font-semibold uppercase tracking-wide text-slate-400">
          {t("guard.station")}
        </span>
        <select
          value={choosingBooth ? (boothId ?? "") : (stationId ?? "")}
          onChange={(event) =>
            choosingBooth
              ? setBoothId(event.target.value)
              : setStationId(event.target.value)
          }
          className="h-10 min-w-0 flex-1 rounded-xl border border-white/15 bg-[#071426] px-3 text-sm font-semibold text-white outline-none focus:border-[#10cfc9]"
        >
          {!selected && <option value="">{t("guard.chooseStation")}</option>}
          {choosingBooth
            ? locations.map((location) => {
                const siteBooths = activeBooths.filter(
                  (booth) => booth.locationId === location.id,
                );
                if (siteBooths.length === 0) return null;
                return (
                  <optgroup key={location.id} label={location.name}>
                    {siteBooths.map((booth) => (
                      <option key={booth.id} value={booth.id}>
                        {booth.name}
                      </option>
                    ))}
                  </optgroup>
                );
              })
            : locations.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.name}
                </option>
              ))}
        </select>
      </label>
      {!selected && (
        <p className="mt-2 text-xs leading-5 text-amber-100">
          {t("guard.chooseStationHint")}
        </p>
      )}
    </div>
  );
}
