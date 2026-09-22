"use client";

import { CalendarPlus } from "lucide-react";
import { useI18n } from "./i18n-provider";
import {
  buildIcs,
  googleCalendarUrl,
  outlookCalendarUrl,
  type CalendarEvent,
} from "@/lib/calendar";

/** Abre la visita en Google, Outlook o como archivo para Apple y el resto. */
export function AddToCalendar({ event }: { event: CalendarEvent }) {
  const { t } = useI18n();

  function download() {
    const blob = new Blob([buildIcs(event)], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "visita-nexa.ics";
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 text-left">
      <p className="flex items-center gap-2 text-sm font-semibold text-[#071426]">
        <CalendarPlus size={16} className="text-[#0d9d99]" />
        {t("calendar.title")}
      </p>
      <p className="mt-1 text-xs leading-5 text-slate-500">{t("calendar.hint")}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <a
          href={googleCalendarUrl(event)}
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-10 items-center rounded-full border border-slate-200 px-3.5 text-sm font-medium text-[#071426] transition hover:bg-slate-50"
        >
          {t("calendar.google")}
        </a>
        <a
          href={outlookCalendarUrl(event)}
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-10 items-center rounded-full border border-slate-200 px-3.5 text-sm font-medium text-[#071426] transition hover:bg-slate-50"
        >
          {t("calendar.outlook")}
        </a>
        <button
          type="button"
          onClick={download}
          className="inline-flex h-10 items-center rounded-full border border-slate-200 px-3.5 text-sm font-medium text-[#071426] transition hover:bg-slate-50"
        >
          {t("calendar.apple")}
        </button>
      </div>
    </div>
  );
}
