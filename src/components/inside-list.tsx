"use client";

import { useMemo, useState } from "react";
import { Clock3, LogOut, Search, Users } from "lucide-react";
import { toast } from "sonner";
import { useWorkspace } from "./workspace-provider";
import { Button, EmptyState, cn, fieldClass } from "./ui";
import { LiveDuration, Sheet } from "./ui-client";
import type { Visit } from "@/lib/domain";
import { useI18n } from "./i18n-provider";

/** Quién está dentro, en vivo, con salida a un toque. */
export function InsideList() {
  const { visits, decide, live, reload } = useWorkspace();
  const { t, formatTime } = useI18n();
  const [confirm, setConfirm] = useState<Visit | null>(null);
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState("");
  const [location, setLocation] = useState("all");

  const inside = visits.filter((visit) => visit.status === "checked_in");
  const locations = useMemo(
    () => [...new Set(inside.map((visit) => visit.location).filter(Boolean))].sort(),
    [inside],
  );
  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return inside.filter((visit) => {
      if (location !== "all" && visit.location !== location) return false;
      if (!needle) return true;
      return [visit.visitorName, visit.company, visit.hostName, visit.location]
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
  }, [inside, location, query]);

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

      {inside.length > 0 && (
        <div className="mb-4 space-y-3">
          <label className="relative block">
            <Search
              size={18}
              className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-slate-400"
            />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              aria-label={t("people.searchAria")}
              placeholder={t("people.searchPlaceholder")}
              className={cn(fieldClass, "pl-11")}
            />
          </label>
          {locations.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              <button
                type="button"
                onClick={() => setLocation("all")}
                className={cn(
                  "shrink-0 rounded-full px-3 py-1.5 text-sm font-medium",
                  location === "all"
                    ? "bg-[#10cfc9] text-[#043b39]"
                    : "bg-white/10 text-slate-200",
                )}
              >
                {t("common.all")}
              </button>
              {locations.map((name) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => setLocation(name)}
                  className={cn(
                    "shrink-0 rounded-full px-3 py-1.5 text-sm font-medium",
                    location === name
                      ? "bg-[#10cfc9] text-[#043b39]"
                      : "bg-white/10 text-slate-200",
                  )}
                >
                  {name}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {inside.length === 0 ? (
        <EmptyState
          dark
          icon={Users}
          title={t("guard.emptyInside")}
          description={t("guard.emptyInsideHint")}
        />
      ) : visible.length === 0 ? (
        <EmptyState
          dark
          icon={Search}
          title={t("people.noMatches")}
          description={t("people.noMatchesHint")}
        />
      ) : (
        <div className="space-y-3">
          {visible.map((visit) => (
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
