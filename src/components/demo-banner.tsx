"use client";

import { resetShowcaseState } from "@/lib/showcase-store";
import { useWorkspace } from "./workspace-provider";
import { useI18n } from "./i18n-provider";

export function DemoBanner({ dark = false }: { dark?: boolean }) {
  const { live } = useWorkspace();
  const { t } = useI18n();
  if (live) return null;

  return (
    <div
      className={
        dark
          ? "mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-sm text-white"
          : "mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#0d9d99]/20 bg-[#f3fbfb] px-4 py-3 text-sm text-[#043b39]"
      }
    >
      <p>{t("demo.banner")}</p>
      <button
        type="button"
        className="font-semibold underline"
        onClick={() => {
          resetShowcaseState();
          window.location.reload();
        }}
      >
        {t("demo.reset")}
      </button>
    </div>
  );
}
