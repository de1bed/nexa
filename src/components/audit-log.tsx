"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { ScrollText } from "lucide-react";
import { useWorkspace } from "./workspace-provider";
import { EmptyState } from "./ui";
import { useI18n } from "./i18n-provider";
import {
  getDemoChangeServerSnapshot,
  getDemoChangeSnapshot,
  subscribeDemoChanges,
  type DemoChange,
} from "@/lib/showcase-store";

type ChangeRow = DemoChange & { reason?: string };

function describe(
  row: { eventType: string; name?: string; reason?: string },
  t: (path: string, vars?: Record<string, string | number>) => string,
) {
  const name = row.name || "";
  const line = (() => {
    switch (row.eventType) {
      case "location_created":
        return t("changes.locationCreated", { name });
      case "booth_created":
        return t("changes.boothCreated", { name });
      case "booth_updated":
        return t("changes.boothUpdated", { name });
      case "booth_activated":
        return t("changes.boothActivated", { name });
      case "booth_deactivated":
        return t("changes.boothDeactivated", { name });
      case "entry_approved":
        return t("changes.entryApproved");
      case "entry_denied":
        return t("changes.entryDenied");
      case "check_out":
        return t("changes.checkedOut");
      case "manual_check_in":
        return t("changes.manual");
      default:
        return row.eventType;
    }
  })();
  return row.reason ? `${line}. ${row.reason}` : line;
}

/** Accesos con guardia y caseta, más los cambios de configuración. */
export function AuditLog() {
  const { events, visits, live } = useWorkspace();
  const { t, formatDateTime } = useI18n();
  const demoChanges = useSyncExternalStore(
    subscribeDemoChanges,
    getDemoChangeSnapshot,
    getDemoChangeServerSnapshot,
  );
  const [remote, setRemote] = useState<ChangeRow[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!live) return;
    let active = true;
    void (async () => {
      try {
        const response = await fetch("/api/audit", { cache: "no-store" });
        if (!response.ok) throw new Error(t("changes.configEmpty"));
        const payload = (await response.json()) as { changes: ChangeRow[] };
        if (active) setRemote(payload.changes ?? []);
      } catch (reason) {
        if (active)
          setError(
            reason instanceof Error ? reason.message : t("changes.configEmpty"),
          );
      }
    })();
    return () => {
      active = false;
    };
  }, [live, t]);

  const changes = live ? remote : demoChanges;
  const access = [...events]
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, 80);

  return (
    <div className="animate-rise">
      <header className="mb-6">
        <p className="text-[13px] font-semibold text-[#0d9d99]">
          {t("changes.eyebrow")}
        </p>
        <h1 className="mt-1.5 text-[30px] font-semibold tracking-[-.03em]">
          {t("changes.title")}
        </h1>
        <p className="mt-1.5 max-w-2xl text-[15px] text-slate-500">
          {t("changes.hint")}
        </p>
      </header>

      <section className="mb-8">
        <h2 className="mb-3 text-lg font-semibold">{t("changes.access")}</h2>
        {access.length === 0 ? (
          <EmptyState
            icon={ScrollText}
            title={t("changes.accessEmpty")}
            description={t("changes.hint")}
          />
        ) : (
          <ol className="divide-y divide-slate-100 overflow-hidden rounded-3xl border border-slate-200 bg-white">
            {access.map((event) => {
              const visit = visits.find((item) => item.id === event.visitId);
              return (
                <li key={event.id} className="px-4 py-3 sm:px-5">
                  <p className="text-sm font-semibold">
                    {visit ? (
                      <Link
                        href={`/app/visits/${visit.id}`}
                        className="underline-offset-2 hover:underline"
                      >
                        {visit.visitorName}
                      </Link>
                    ) : (
                      t("common.visit")
                    )}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {t(`events.${event.type}`)} · {formatDateTime(event.at)} ·{" "}
                    {event.actor}
                    {event.booth ? ` · ${event.booth}` : ""}
                  </p>
                  {event.detail && (
                    <p className="mt-1 text-xs text-red-600">{event.detail}</p>
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">{t("changes.config")}</h2>
        {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
        {changes.length === 0 ? (
          <EmptyState
            icon={ScrollText}
            title={t("changes.config")}
            description={t("changes.configEmpty")}
          />
        ) : (
          <ol className="divide-y divide-slate-100 overflow-hidden rounded-3xl border border-slate-200 bg-white">
            {changes.map((row) => (
              <li key={row.id} className="px-4 py-3 sm:px-5">
                <p className="text-sm font-medium">{describe(row, t)}</p>
                <p className="mt-0.5 text-xs text-slate-500">
                  {formatDateTime(row.at)} · {row.actor}
                </p>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
