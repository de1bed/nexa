"use client";

import { useState } from "react";
import { Eye, EyeOff, ShieldCheck } from "lucide-react";
import { useI18n } from "./i18n-provider";
import { InfoTip } from "./info-tip";
import { Button, Card } from "./ui";
import type { TeamMember } from "@/lib/domain";

export function GuardRoster({
  guards,
  onCreate,
}: {
  guards: TeamMember[];
  onCreate: () => void;
}) {
  const { t } = useI18n();
  const [shown, setShown] = useState<Record<string, boolean>>({});

  return (
    <Card className="h-full p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-[#071426] text-white">
          <ShieldCheck size={18} />
        </span>
        <div>
          <h2 className="flex items-center gap-2 font-semibold">
            {t("team.guardsTitle")}
            <InfoTip label={t("team.guardsAbout")}>{t("team.guardsAboutBody")}</InfoTip>
          </h2>
          <p className="mt-1 text-sm leading-5 text-slate-500">{t("team.guardsLead")}</p>
        </div>
      </div>

      <ul className="mt-4 space-y-2">
        {guards.map((guard) => {
          const open = Boolean(shown[guard.id]);
          const code = guard.accessCode ?? "";
          return (
            <li
              key={guard.id}
              className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 px-3 py-2.5 text-sm"
            >
              <span className="min-w-0">
                <span className="block truncate font-semibold">{guard.name}</span>
                <span className="block text-xs text-slate-500">{t("team.anyBooth")}</span>
              </span>
              {code ? (
                <span className="flex shrink-0 items-center gap-1">
                  <span className="font-mono text-sm tracking-wide">
                    {open ? code : "••••-••••"}
                  </span>
                  <button
                    type="button"
                    aria-label={open ? t("team.hideCode") : t("team.showCode")}
                    aria-pressed={open}
                    onClick={() =>
                      setShown((current) => ({ ...current, [guard.id]: !current[guard.id] }))
                    }
                    className="grid size-9 place-items-center rounded-xl text-slate-500 transition hover:bg-white hover:text-[#071426]"
                  >
                    {open ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </span>
              ) : (
                <span className="max-w-40 text-right text-xs leading-5 text-slate-400">
                  {t("team.codeMissing")}
                </span>
              )}
            </li>
          );
        })}
      </ul>

      <Button type="button" className="mt-4" onClick={onCreate}>
        {t("team.createGuard")}
      </Button>
    </Card>
  );
}
