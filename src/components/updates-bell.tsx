"use client";

import { useEffect, useId, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { Bell } from "lucide-react";
import { useI18n } from "./i18n-provider";
import { isLiveMode } from "@/lib/config";

const UPDATE_ID = "2026-10-tablet";
const STORAGE_KEY = "nexa-updates-seen";

const steps = ["company", "user", "code", "switch"] as const;

type Snap = { open: boolean; unread: boolean; booted: boolean };

let snap: Snap = { open: false, unread: false, booted: false };
const serverSnap: Snap = { open: false, unread: false, booted: false };
const listeners = new Set<() => void>();
let dialogHostId: string | null = null;

function emit(next: Snap) {
  snap = next;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return snap.booted ? snap : serverSnap;
}

function boot() {
  if (snap.booted) return;
  let seen = true;
  try {
    seen = localStorage.getItem(STORAGE_KEY) === UPDATE_ID;
  } catch {
    seen = true;
  }
  emit({ open: !seen, unread: !seen, booted: true });
}

function dismissUpdate() {
  try {
    localStorage.setItem(STORAGE_KEY, UPDATE_ID);
  } catch {
    // Si el navegador bloquea el almacenamiento, el aviso se puede cerrar igual.
  }
  emit({ open: false, unread: false, booted: true });
}

function openUpdate() {
  emit({ ...snap, open: true, booted: true });
}

/**
 * Campanita de novedades. La primera vez abre sola el aviso de las tabletas.
 * Después se vuelve a leer desde el mismo botón.
 * Varias campanitas comparten un solo aviso, dibujado sobre la página.
 */
export function UpdatesBell({
  dark = false,
  teamHref = false,
}: {
  dark?: boolean;
  teamHref?: boolean;
}) {
  const { t } = useI18n();
  const titleId = useId();
  const demo = !isLiveMode();
  const [instanceId] = useState(() => titleId);
  const state = useSyncExternalStore(subscribe, getSnapshot, () => serverSnap);
  const isHost = useSyncExternalStore(
    subscribe,
    () => dialogHostId === instanceId,
    () => false,
  );

  useEffect(() => {
    boot();
    if (dialogHostId) return;
    dialogHostId = instanceId;
    listeners.forEach((listener) => listener());
    return () => {
      if (dialogHostId === instanceId) dialogHostId = null;
      listeners.forEach((listener) => listener());
    };
  }, [instanceId]);

  useEffect(() => {
    if (!state.open || !isHost) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") dismissUpdate();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [state.open, isHost]);

  const dialog =
    isHost && state.open
      ? createPortal(
          <div className="fixed inset-0 z-50 grid place-items-center p-4">
            <button
              type="button"
              aria-label={t("updates.close")}
              className="absolute inset-0 bg-[#071426]/50"
              onClick={dismissUpdate}
            />
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby={titleId}
              className="relative max-h-[min(640px,calc(100vh-2rem))] w-full max-w-md overflow-y-auto rounded-3xl bg-white p-6 text-[#071426] shadow-2xl"
            >
              <p className="text-sm font-semibold text-[#0d9d99]">{t("updates.eyebrow")}</p>
              <h2 id={titleId} className="mt-1 text-2xl font-semibold tracking-[-.03em]">
                {t("updates.title")}
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">{t("updates.lead")}</p>

              <ol className="mt-5 space-y-4">
                {steps.map((step, index) => (
                  <li key={step} className="flex gap-3">
                    <span className="grid size-7 shrink-0 place-items-center rounded-full bg-[#071426] text-xs font-semibold text-white">
                      {index + 1}
                    </span>
                    <span>
                      <span className="block text-sm font-semibold">
                        {t(`updates.${step}Title`)}
                      </span>
                      <span className="mt-1 block text-sm leading-6 text-slate-500">
                        {t(`updates.${step}Body`)}
                      </span>
                    </span>
                  </li>
                ))}
              </ol>

              <p className="mt-5 text-sm leading-6 text-slate-600">{t("updates.manage")}</p>
              {demo && (
                <p className="mt-3 rounded-2xl bg-slate-50 p-3 text-sm leading-6 text-slate-600">
                  {t("updates.demoNote")}
                </p>
              )}

              <div className="mt-5 flex flex-col gap-2">
                {teamHref && (
                  <Link
                    href="/app/team"
                    onClick={dismissUpdate}
                    className="grid h-12 place-items-center rounded-2xl bg-[#071426] text-sm font-semibold text-white"
                  >
                    {t("updates.openTeam")}
                  </Link>
                )}
                <button
                  type="button"
                  onClick={dismissUpdate}
                  className={`grid h-12 place-items-center rounded-2xl text-sm font-semibold ${
                    teamHref ? "text-slate-500" : "bg-[#10cfc9] text-[#043b39]"
                  }`}
                >
                  {t("updates.close")}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <button
        type="button"
        aria-label={state.unread ? t("updates.unread") : t("updates.bell")}
        aria-expanded={state.open}
        onClick={openUpdate}
        className={`relative grid size-10 place-items-center rounded-xl transition ${
          dark
            ? "text-slate-300 hover:bg-white/10 hover:text-white"
            : "text-slate-500 hover:bg-slate-100 hover:text-[#071426]"
        }`}
      >
        <Bell size={18} />
        {state.unread && (
          <span className="absolute top-2 right-2 size-2 rounded-full bg-[#10cfc9]" />
        )}
      </button>
      {dialog}
    </>
  );
}
