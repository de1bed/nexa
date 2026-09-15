"use client";

import { useRouter } from "next/navigation";
import { cn } from "./ui";
import { useI18n } from "./i18n-provider";
import type { Locale } from "@/lib/i18n/types";

export function LanguageSwitcher({
  dark = false,
  compact = false,
}: {
  dark?: boolean;
  compact?: boolean;
}) {
  const { locale, setLocale, t } = useI18n();
  const router = useRouter();
  const options: Locale[] = ["es", "en"];

  return (
    <div
      role="group"
      aria-label={t("common.language")}
      className={cn(
        "inline-flex rounded-full border p-0.5 text-[11px] font-semibold",
        dark ? "border-white/15 bg-white/5" : "border-slate-200 bg-white",
      )}
    >
      {options.map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => {
            setLocale(option);
            router.refresh();
          }}
          aria-pressed={locale === option}
          className={cn(
            "rounded-full px-2.5 py-1 transition",
            compact && "px-2",
            locale === option
              ? dark
                ? "bg-[#10cfc9] text-[#043b39]"
                : "bg-[#071426] text-white"
              : dark
                ? "text-slate-300"
                : "text-slate-500",
          )}
        >
          {option === "es" ? "ES" : "EN"}
        </button>
      ))}
    </div>
  );
}
