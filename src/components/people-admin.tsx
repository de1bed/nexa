"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Clock3, LogOut, Search, Users } from "lucide-react";
import { toast } from "sonner";
import { useWorkspace } from "./workspace-provider";
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
import { formatDuration, timeInsideMs, type Visit } from "@/lib/domain";

const time = (value: string) =>
  new Intl.DateTimeFormat("es-MX", { timeStyle: "short" }).format(
    new Date(value),
  );

/** Vista de administración de quién está dentro, con búsqueda y salida manual. */
export function PeopleAdmin() {
  const { visits, decide, live, reload } = useWorkspace();
  const [query, setQuery] = useState("");
  const [confirm, setConfirm] = useState<Visit | null>(null);
  const [busy, setBusy] = useState(false);

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

  const longest = useMemo(
    () =>
      inside.reduce(
        (max, visit) => Math.max(max, timeInsideMs(visit)),
        0,
      ),
    [inside],
  );

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
    <>
      <header className="mb-6">
        <p className="text-[13px] font-semibold text-[#0d9d99]">Tiempo real</p>
        <h1 className="mt-1.5 text-[26px] font-semibold tracking-[-.03em] sm:text-3xl">
          Personas dentro
        </h1>
        <p className="mt-1.5 text-[15px] text-slate-500">
          Control de aforo y tiempos de estancia en curso.
        </p>
      </header>

      <section className="mb-5 grid grid-cols-2 gap-3">
        <MetricTile
          label="En instalaciones"
          value={inside.length}
          icon={Users}
          tone="success"
        />
        <MetricTile
          label="Estancia más larga"
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
            aria-label="Buscar personas dentro"
            placeholder="Buscar por nombre, empresa o anfitrión…"
            className={cn(fieldClass, "pl-11")}
          />
        </label>
      )}

      {rows.length === 0 ? (
        <EmptyState
          icon={Users}
          title={
            inside.length === 0
              ? "No hay visitantes dentro"
              : "Sin coincidencias"
          }
          description={
            inside.length === 0
              ? "Las entradas validadas en caseta aparecerán aquí al instante."
              : "Prueba con otro nombre o empresa."
          }
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {rows.map((visit) => (
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
                    {visit.company || "Sin empresa"}
                  </p>
                </div>
              </div>

              <dl className="mt-4 space-y-1.5 rounded-2xl bg-slate-50 p-4 text-sm">
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-500">Anfitrión</dt>
                  <dd className="truncate font-medium">{visit.hostName}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-500">Ubicación</dt>
                  <dd className="truncate font-medium">{visit.location}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-500">Entrada</dt>
                  <dd className="font-medium">
                    {visit.checkedInAt ? time(visit.checkedInAt) : "—"}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-500">Lleva dentro</dt>
                  <dd className="font-semibold text-emerald-700">
                    <LiveDuration since={visit.checkedInAt} />
                  </dd>
                </div>
              </dl>

              <Button
                variant="outline"
                block
                className="mt-4"
                onClick={() => setConfirm(visit)}
              >
                <LogOut size={16} />
                Registrar salida
              </Button>
            </Card>
          ))}
        </div>
      )}

      <Sheet
        open={Boolean(confirm)}
        onClose={() => setConfirm(null)}
        title="¿Registrar la salida?"
        description={
          confirm
            ? `${confirm.visitorName} dejará de contar en el aforo y su pase se desactivará.`
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
    </>
  );
}
