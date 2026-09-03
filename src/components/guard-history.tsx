"use client";

import { useMemo } from "react";
import { History, LogIn, LogOut, ShieldX, UserRoundCheck } from "lucide-react";
import { useWorkspace } from "./workspace-provider";
import { useNow } from "./ui-client";
import { EmptyState, cn } from "./ui";
import { eventLabels, type AccessEventType } from "@/lib/domain";

const iconByType: Record<AccessEventType, typeof LogIn> = {
  check_in: LogIn,
  check_out: LogOut,
  denied: ShieldX,
  qr_scanned: History,
  pre_registered: UserRoundCheck,
  invitation_created: UserRoundCheck,
  invitation_resent: UserRoundCheck,
  cancelled: ShieldX,
};

const toneByType: Record<AccessEventType, string> = {
  check_in: "bg-emerald-500/15 text-emerald-300",
  check_out: "bg-blue-500/15 text-blue-300",
  denied: "bg-red-500/15 text-red-300",
  qr_scanned: "bg-white/10 text-slate-300",
  pre_registered: "bg-cyan-500/15 text-cyan-300",
  invitation_created: "bg-white/10 text-slate-300",
  invitation_resent: "bg-white/10 text-slate-300",
  cancelled: "bg-amber-500/15 text-amber-300",
};

/** Bitácora del turno, agrupada por día. */
export function GuardHistory() {
  const { events, visits } = useWorkspace();
  const now = useNow();

  // El agrupado y las etiquetas relativas se calculan juntos: así el reloj se
  // consulta una sola vez y el render queda libre de llamadas impuras.
  const groups = useMemo(() => {
    const today = now ? new Date(now).toDateString() : "";
    const yesterday = now ? new Date(now - 86400000).toDateString() : "";

    const sorted = [...events]
      .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
      .slice(0, 60);

    const buckets = new Map<string, typeof sorted>();
    sorted.forEach((event) => {
      const key = new Date(event.at).toDateString();
      buckets.set(key, [...(buckets.get(key) ?? []), event]);
    });

    return [...buckets.entries()].map(([day, items]) => ({
      day,
      items,
      label:
        day === today
          ? "Hoy"
          : day === yesterday
            ? "Ayer"
            : new Intl.DateTimeFormat("es-MX", {
                weekday: "long",
                day: "numeric",
                month: "long",
              }).format(new Date(day)),
    }));
  }, [events, now]);

  return (
    <div className="animate-rise">
      <header className="mb-6">
        <p className="text-[13px] font-semibold text-[#10cfc9]">
          Bitácora del turno
        </p>
        <h1 className="mt-1.5 text-[30px] font-semibold tracking-[-.03em]">
          Actividad reciente
        </h1>
      </header>

      {groups.length === 0 ? (
        <EmptyState
          dark
          icon={History}
          title="Sin movimientos registrados"
          description="Cada entrada, salida y rechazo quedará documentado aquí."
        />
      ) : (
        <div className="space-y-7">
          {groups.map(({ day, items, label }) => (
            <section key={day}>
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
                {label}
              </h2>
              <div className="space-y-2">
                {items.map((event) => {
                  const visit = visits.find((item) => item.id === event.visitId);
                  const Icon = iconByType[event.type];
                  return (
                    <div
                      key={event.id}
                      className="flex gap-3 rounded-2xl bg-white/[.06] p-4"
                    >
                      <span
                        className={cn(
                          "grid size-10 shrink-0 place-items-center rounded-full",
                          toneByType[event.type],
                        )}
                      >
                        <Icon size={17} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {visit?.visitorName ?? "Visita"}
                        </p>
                        <p className="mt-0.5 text-xs text-slate-400">
                          {eventLabels[event.type]} ·{" "}
                          {new Intl.DateTimeFormat("es-MX", {
                            timeStyle: "short",
                          }).format(new Date(event.at))}{" "}
                          · {event.actor}
                        </p>
                        {event.detail && (
                          <p className="mt-1 text-xs text-red-300">
                            {event.detail}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
