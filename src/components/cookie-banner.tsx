"use client";

import { useSyncExternalStore, useCallback } from "react";
import Link from "next/link";
import { X } from "lucide-react";

const COOKIE_CONSENT_KEY = "nexa-cookie-consent";

function getConsentSnapshot(): boolean {
  try {
    return !localStorage.getItem(COOKIE_CONSENT_KEY);
  } catch {
    return false;
  }
}

function getServerSnapshot(): boolean {
  return false;
}

let listeners: Array<() => void> = [];

function subscribeToConsent(callback: () => void): () => void {
  listeners = [...listeners, callback];
  return () => {
    listeners = listeners.filter((l) => l !== callback);
  };
}

function notifyListeners() {
  listeners.forEach((l) => l());
}

export function CookieBanner() {
  const shouldShow = useSyncExternalStore(
    subscribeToConsent,
    getConsentSnapshot,
    getServerSnapshot,
  );

  const accept = useCallback(() => {
    try {
      localStorage.setItem(COOKIE_CONSENT_KEY, "accepted");
      notifyListeners();
    } catch {
      // localStorage blocked - just hide the banner for this session
      notifyListeners();
    }
  }, []);

  if (!shouldShow) return null;

  return (
    <div
      role="dialog"
      aria-label="Aviso de cookies"
      className="fixed inset-x-0 bottom-0 z-50 animate-slide-up sm:bottom-4 sm:left-4 sm:right-auto sm:max-w-md"
    >
      <div className="mx-2 mb-2 rounded-2xl border border-slate-200 bg-white p-4 shadow-lg sm:mx-0 sm:mb-0">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-sm leading-6 text-slate-600">
              Usamos cookies esenciales para que la plataforma funcione y una
              cookie para recordar tu idioma.{" "}
              <Link
                href="/cookies"
                className="font-medium text-[#0d9d99] hover:underline"
              >
                Más información
              </Link>
            </p>
          </div>
          <button
            type="button"
            onClick={accept}
            className="shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label="Cerrar aviso de cookies"
          >
            <X size={18} />
          </button>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={accept}
            className="rounded-xl bg-[#071426] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#0d2040] active:scale-[.98]"
          >
            Entendido
          </button>
          <Link
            href="/privacidad"
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 active:scale-[.98]"
          >
            Privacidad
          </Link>
        </div>
      </div>
    </div>
  );
}
