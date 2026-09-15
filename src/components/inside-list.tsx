"use client";

import { useState } from "react";
import { Clock3, LogOut, Users } from "lucide-react";
import { toast } from "sonner";
import { useWorkspace } from "./workspace-provider";
import { Button, EmptyState } from "./ui";
import { LiveDuration, Sheet } from "./ui-client";
import type { Visit } from "@/lib/domain";
import { useI18n } from "./i18n-provider";

/** Quién está dentro, en vivo, con salida a un toque. */
export function InsideList() {
  const { visits, decide, live, reload } = useWorkspace();
  const { t, formatTime } = useI18n();
  const [confirm, setConfirm] = useState<Visit | null>(null);
  const [busy, setBusy] = useState(false);

  const inside = visits.filter((visit) => visit.status === "checked_in");

  async function checkOut(visit: Visit) {
    setBusy(true);
    try {
      await decide(visit.id, "checked_out");
      toast.success(t("people.checkoutToast", { name: visit.visitorName }));
      setConfirm(null);
      if (live) void reload();
    } catch (reason) {
      toast.error(
        reason instanceof Error
          ? reason.message
          : t("guard.decisionFail"),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="animate-rise">
      <header className="mb-6">
        <p className="text-[13px] font-semibold text-[#10cfc9]">
          {t("people.liveEyebrow")}
        </p>
        <h1 className="mt-1.5 text-[30px] font-semibold tracking-[-.03em]">
          {t("people.title")}{" "}
          <span className="text-[#10cfc9]">{inside.length}</span>
        </h1>
      </header>

      {inside.length === 0 ? (
        <EmptyState
          dark
          icon={Users}
          title={t("guard.emptyInside")}
          description={t("guard.emptyInsideHint")}
        />
      ) : (
        <div className="space-y-3">
          {inside.map((visit) => (
            <article
              key={visit.id}
              className="rounded-3xl bg-white p-5 text-[#071426]"
            >
              <div className="flex items-center gap-3">
                <span className="grid size-12 shrink-0 place-items-center rounded-full bg-slate-100 font-semibold">
                  {visit.visitorName
                    .split(" ")
                    .map((part) => part[0])
                    .slice(0, 2)
                    .join("")}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{visit.visitorName}</p>
                  <p className="truncate text-sm text-slate-500">
                    {visit.company || t("common.noCompany")} · {visit.hostName}
                    {visit.location ? ` · ${visit.location}` : ""}
                  </p>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4">
                <span className="flex items-center gap-1.5 text-xs text-slate-500">
                  <Clock3 size={14} />
                  <LiveDuration since={visit.checkedInAt} />
                  {visit.checkedInAt && ` · ${t("dashboard.since", { time: formatTime(visit.checkedInAt) })}`}
                </span>
                <Button size="sm" onClick={() => setConfirm(visit)}>
                  <LogOut size={16} />
                  {t("people.checkout")}
                </Button>
              </div>
            </article>
          ))}
        </div>
      )}

      <Sheet
        open={Boolean(confirm)}
        onClose={() => setConfirm(null)}
        title={t("people.checkoutConfirm")}
        description={
          confirm
            ? t("people.checkoutHint", { name: confirm.visitorName })
            : undefined
        }
      >
        <div className="flex gap-3">
          <Button
            variant="outline"
            size="lg"
            className="flex-1"
            onClick={() => setConfirm(null)}
          >
            {t("common.cancel")}
          </Button>
          <Button
            variant="primary"
            size="lg"
            className="flex-1"
            disabled={busy}
            onClick={() => confirm && checkOut(confirm)}
          >
            <LogOut size={18} />
            {t("people.recordCheckout")}
          </Button>
        </div>
      </Sheet>
    </div>
  );
}
