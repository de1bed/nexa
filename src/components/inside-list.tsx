"use client";

import { useState } from "react";
import { Clock3, LogOut, Users } from "lucide-react";
import { toast } from "sonner";
import { useWorkspace } from "./workspace-provider";
import { Button, EmptyState } from "./ui";
import { LiveDuration, Sheet } from "./ui-client";
import type { Visit } from "@/lib/domain";

const time = (value: string) =>
  new Intl.DateTimeFormat("es-MX", { timeStyle: "short" }).format(
    new Date(value),
  );

/** Quién está dentro, en vivo, con salida a un toque. */
export function InsideList() {
  const { visits, decide, live, reload } = useWorkspace();
  const [confirm, setConfirm] = useState<Visit | null>(null);
  const [busy, setBusy] = useState(false);

  const inside = visits.filter((visit) => visit.status === "checked_in");

  async function checkOut(visit: Visit) {
    setBusy(true);
    try {
      await decide(visit.id, "checked_out");
      toast.success(`Salida de ${visit.visitorName} registrada`);
      setConfirm(null);
      if (live) void reload();
    } catch (reason) {
      toast.error(
        reason instanceof Error
          ? reason.message
          : "No fue posible registrar la salida",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="animate-rise">
      <header className="mb-6">
        <p className="text-[13px] font-semibold text-[#10cfc9]">
          Estado en tiempo real
        </p>
        <h1 className="mt-1.5 text-[30px] font-semibold tracking-[-.03em]">
          Personas dentro{" "}
          <span className="text-[#10cfc9]">{inside.length}</span>
        </h1>
      </header>

      {inside.length === 0 ? (
        <EmptyState
          dark
          icon={Users}
          title="Las instalaciones están vacías"
          description="Cuando valides un pase, la persona aparecerá aquí."
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
                    {visit.company || "Sin empresa"} · {visit.hostName}
                    {visit.location ? ` · ${visit.location}` : ""}
                  </p>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4">
                <span className="flex items-center gap-1.5 text-xs text-slate-500">
                  <Clock3 size={14} />
                  <LiveDuration since={visit.checkedInAt} />
                  {visit.checkedInAt && ` · desde ${time(visit.checkedInAt)}`}
                </span>
                <Button size="sm" onClick={() => setConfirm(visit)}>
                  <LogOut size={16} />
                  Salida
                </Button>
              </div>
            </article>
          ))}
        </div>
      )}

      <Sheet
        open={Boolean(confirm)}
        onClose={() => setConfirm(null)}
        title="¿Registrar la salida?"
        description={
          confirm
            ? `${confirm.visitorName} dejará de aparecer como presente y su pase se desactivará.`
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
            Cancelar
          </Button>
          <Button
            variant="primary"
            size="lg"
            className="flex-1"
            disabled={busy}
            onClick={() => confirm && checkOut(confirm)}
          >
            <LogOut size={18} />
            Registrar salida
          </Button>
        </div>
      </Sheet>
    </div>
  );
}
