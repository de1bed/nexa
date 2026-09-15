"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Clock3, Download, LogOut, Search, Users } from "lucide-react";
import { toast } from "sonner";
import { useMyVisits, useWorkspace } from "./workspace-provider";
import {
  Avatar,
  Button,
  Card,
  EmptyState,
  MetricTile,
  cn,
  fieldClass,
} from "./ui";
import { LiveDuration, Sheet } from "./ui-client";
import { safeCsvCell } from "@/lib/security";
import { timeInsideMs, type Visit } from "@/lib/domain";
import { useI18n } from "./i18n-provider";

/** Vista de quién está dentro, con búsqueda y salida manual. */
export function PeopleAdmin() {
  const { decide, live, reload, viewer, organization, syncedAt } =
    useWorkspace();
  const { t, formatDateTime, formatDuration } = useI18n();
  const visits = useMyVisits();
  const [query, setQuery] = useState("");
  const [confirm, setConfirm] = useState<Visit | null>(null);
  const [busy, setBusy] = useState(false);
  const hostView = viewer.role === "host";
  const canCheckOut = ["superadmin", "admin", "guard"].includes(viewer.role);

  const inside = useMemo(
    () => visits.filter((visit) => visit.status === "checked_in"),
    [visits],
  );

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return inside;
    return inside.filter((visit) =>
      [visit.visitorName, visit.company, visit.hostName, visit.location]
        .join(" ")
        .toLowerCase()
        .includes(needle),
    );
  }, [inside, query]);

  const grouped = useMemo(() => {
    const map = new Map<string, Visit[]>();
    for (const visit of rows) {
      const key = visit.location || t("common.noLocation");
      const list = map.get(key) ?? [];
      list.push(visit);
      map.set(key, list);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [rows, t]);

  const longest = useMemo(
    () => inside.reduce((max, visit) => Math.max(max, timeInsideMs(visit)), 0),
    [inside],
  );

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

  function exportInside() {
    const generated = formatDateTime(syncedAt ?? new Date().toISOString());
    const content = [
      [t("people.organization"), organization.name],
      [t("people.document"), hostView ? t("people.hostInside") : t("people.allInside")],
      [t("people.generated"), generated],
      [t("people.present"), String(inside.length)],
      [],
      [
        t("people.visitor"),
        t("common.company"),
        t("visits.host"),
        t("visits.location"),
        t("invite.purpose"),
        t("common.entry"),
        t("reports.timeInside"),
        t("visits.identification"),
      ],
      ...inside.map((visit) => [
        visit.visitorName,
        visit.company || t("common.noCompany"),
        visit.hostName,
        visit.location,
        visit.purpose,
        formatDateTime(visit.checkedInAt ?? ""),
        formatDuration(timeInsideMs(visit)),
        visit.documentMasked ||
          (visit.documentCaptured ? t("people.captured") : t("visits.notCaptured")),
      ]),
    ]
      .map((row) => row.map(safeCsvCell).join(","))
      .join("\r\n");

    const blob = new Blob([`\uFEFF${content}`], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `nexa-dentro-${organization.name.replace(/\s+/g, "-").toLowerCase()}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[13px] font-semibold text-[#0d9d99]">{t("people.live")}</p>
          <h1 className="mt-1.5 text-[26px] font-semibold tracking-[-.03em] sm:text-3xl">
            {hostView ? t("people.mine") : t("people.title")}
          </h1>
          <p className="mt-1.5 text-[15px] text-slate-500">
            {hostView ? t("people.hostHint") : t("people.opsHint")}
          </p>
          {syncedAt && (
            <p className="mt-1 text-xs text-slate-400">
              {t("people.updated", { time: formatDateTime(syncedAt) })}
            </p>
          )}
        </div>
        {inside.length > 0 && (
          <Button variant="outline" size="sm" onClick={exportInside}>
            <Download size={16} />
            {t("people.export")}
          </Button>
        )}
      </header>

      <section className="mb-5 grid grid-cols-2 gap-3">
        <MetricTile
          label={t("people.onSite")}
          value={inside.length}
          icon={Users}
          tone="success"
        />
        <MetricTile
          label={t("people.longest")}
          value={longest ? formatDuration(longest) : "—"}
          icon={Clock3}
          tone="warning"
        />
      </section>

      {inside.length > 0 && (
        <label className="relative mb-4 block">
          <Search
            size={18}
            className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            aria-label={t("people.searchAria")}
            placeholder={t("people.searchPlaceholder")}
            className={cn(fieldClass, "pl-11")}
          />
        </label>
      )}

      {rows.length === 0 ? (
        <EmptyState
          icon={Users}
          title={
            inside.length === 0
              ? t("people.noneInside")
              : t("people.noMatches")
          }
          description={
            inside.length === 0
              ? t("people.noneHint")
              : t("people.noMatchesHint")
          }
        />
      ) : (
        <div className="space-y-5">
          {grouped.map(([location, people]) => (
            <section key={location}>
              <div className="mb-2 flex items-center justify-between gap-3">
                <h2 className="text-sm font-semibold text-slate-600">
                  {location}
                </h2>
                <span className="text-xs text-slate-400">
                  {people.length} persona{people.length === 1 ? "" : "s"}
                </span>
              </div>
              <Card className="hidden overflow-hidden p-0 md:block">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-4 py-3 font-semibold">{t("people.visitor")}</th>
                      <th className="px-4 py-3 font-semibold">{t("common.company")}</th>
                      {!hostView && (
                        <th className="px-4 py-3 font-semibold">{t("visits.host")}</th>
                      )}
                      <th className="px-4 py-3 font-semibold">{t("common.entry")}</th>
                      <th className="px-4 py-3 font-semibold">{t("people.timeInside")}</th>
                      {canCheckOut && <th className="px-4 py-3" />}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {people.map((visit) => (
                      <tr key={visit.id}>
                        <td className="px-4 py-3">
                          <Link
                            href={`/app/visits/${visit.id}`}
                            className="font-semibold hover:text-blue-600"
                          >
                            {visit.visitorName}
                          </Link>
                          <p className="text-xs text-slate-400">{visit.purpose}</p>
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {visit.company || t("common.noCompany")}
                        </td>
                        {!hostView && (
                          <td className="px-4 py-3">{visit.hostName}</td>
                        )}
                        <td className="whitespace-nowrap px-4 py-3">
                          {formatDateTime(visit.checkedInAt ?? "") || "—"}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 font-semibold text-emerald-700">
                          <LiveDuration since={visit.checkedInAt} />
                        </td>
                        {canCheckOut && (
                          <td className="px-4 py-3 text-right">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setConfirm(visit)}
                            >
                              <LogOut size={14} />
                              {t("people.checkout")}
                            </Button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>

              <div className="grid gap-3 md:hidden">
                {people.map((visit) => (
                  <Card key={visit.id} className="p-5">
                    <div className="flex items-center gap-3">
                      <Avatar name={visit.visitorName} size={46} tone="accent" />
                      <div className="min-w-0 flex-1">
                        <Link
                          href={`/app/visits/${visit.id}`}
                          className="block truncate font-semibold hover:text-blue-600"
                        >
                          {visit.visitorName}
                        </Link>
                        <p className="truncate text-sm text-slate-500">
                          {visit.company || t("common.noCompany")}
                        </p>
                      </div>
                    </div>

                    <dl className="mt-4 space-y-1.5 rounded-2xl bg-slate-50 p-4 text-sm">
                      {!hostView && (
                        <div className="flex justify-between gap-3">
                          <dt className="text-slate-500">{t("visits.host")}</dt>
                          <dd className="truncate font-medium">{visit.hostName}</dd>
                        </div>
                      )}
                      <div className="flex justify-between gap-3">
                        <dt className="text-slate-500">{t("common.entry")}</dt>
                        <dd className="font-medium">
                          {formatDateTime(visit.checkedInAt ?? "") || "—"}
                        </dd>
                      </div>
                      <div className="flex justify-between gap-3">
                        <dt className="text-slate-500">{t("people.timeInside")}</dt>
                        <dd className="font-semibold text-emerald-700">
                          <LiveDuration since={visit.checkedInAt} />
                        </dd>
                      </div>
                    </dl>

                    {canCheckOut && (
                      <Button
                        variant="outline"
                        block
                        className="mt-4"
                        onClick={() => setConfirm(visit)}
                      >
                        <LogOut size={16} />
                        {t("people.recordCheckout")}
                      </Button>
                    )}
                  </Card>
                ))}
              </div>
            </section>
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
    </>
  );
}
