"use client";

import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";
import { useI18n } from "./i18n-provider";

/** Aviso persistente cuando el dispositivo pierde conexión en caseta o recepción. */
export function OfflineBanner() {
  const [offline, setOffline] = useState(false);
  const { t } = useI18n();

  useEffect(() => {
    const sync = () => setOffline(!navigator.onLine);
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);

  if (!offline) return null;

  return (
    <div
      role="status"
      className="safe-top fixed inset-x-3 top-3 z-[100] mx-auto flex max-w-md items-center justify-center gap-2 rounded-2xl bg-amber-500 px-4 py-3 text-sm font-semibold text-[#071426] shadow-xl"
    >
      <WifiOff size={17} />
      {t("offline")}
    </div>
  );
}
