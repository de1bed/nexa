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
import {
  formatDateTimeMx,
  formatDuration,
  timeInsideMs,
  type Visit,
} from "@/lib/domain";

/** Vista de quién está dentro, con búsqueda y salida manual. */
export function PeopleAdmin() {
  const { decide, live, reload, viewer, organization, syncedAt } =
    useWorkspace();
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
      const key = visit.location || "Sin ubicación";
      const list = map.get(key) ?? [];
      list.push(visit);
      map.set(key, list);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [rows]);

  const longest = useMemo(
    () => inside.reduce((max, visit) => Math.max(max, timeInsideMs(visit)), 0),
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

  function exportInside() {
    const generated = formatDateTimeMx(syncedAt ?? new Date().toISOString());
    const content = [
      ["Organización", organization.name],
      ["Documento", hostView ? "Visitantes del anfitrión dentro" : "Personas dentro ahora"],
      ["Generado", generated],
      ["Presentes", String(inside.length)],
      [],
      [
        "Visitante",
        "Empresa",
        "Anfitrión",
        "Ubicación",
        "Motivo",
        "Entrada",
        "Tiempo dentro",
        "Identificación",
      ],
      ...inside.map((visit) => [
        visit.visitorName,
        visit.company || "Sin empresa",
        visit.hostName,
        visit.location,
        visit.purpose,
        formatDateTimeMx(visit.checkedInAt),
        formatDuration(timeInsideMs(visit)),
        visit.documentMasked || (visit.documentCaptured ? "Capturada" : "No capturada"),
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
          <p className="text-[13px] font-semibold text-[#0d9d99]">Tiempo real</p>
          <h1 className="mt-1.5 text-[26px] font-semibold tracking-[-.03em] sm:text-3xl">
            {hostView ? "Mis visitantes dentro" : "Personas dentro"}
          </h1>
          <p className="mt-1.5 text-[15px] text-slate-500">
            {hostView
              ? "Quién de tus invitados está ahora en las instalaciones."
              : "Aforo actual por ubicación, con hora de entrada y tiempo de estancia."}
          </p>
          {syncedAt && (
            <p className="mt-1 text-xs text-slate-400">
              Actualizado {formatDateTimeMx(syncedAt)}
            </p>
          )}
        </div>
        {inside.length > 0 && (
          <Button variant="outline" size="sm" onClick={exportInside}>
            <Download size={16} />
            Exportar
          </Button>
        )}
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
            placeholder="Buscar por nombre, empresa, anfitrión o sede…"
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
                      <th className="px-4 py-3 font-semibold">Visitante</th>
                      <th className="px-4 py-3 font-semibold">Empresa</th>
                      {!hostView && (
                        <th className="px-4 py-3 font-semibold">Anfitrión</th>
                      )}
                      <th className="px-4 py-3 font-semibold">Entrada</th>
                      <th className="px-4 py-3 font-semibold">Lleva dentro</th>
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
                          {visit.company || "Sin empresa"}
                        </td>
                        {!hostView && (
                          <td className="px-4 py-3">{visit.hostName}</td>
                        )}
                        <td className="whitespace-nowrap px-4 py-3">
                          {formatDateTimeMx(visit.checkedInAt) || "—"}
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
                              Salida
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
                          {visit.company || "Sin empresa"}
                        </p>
                      </div>
                    </div>

                    <dl className="mt-4 space-y-1.5 rounded-2xl bg-slate-50 p-4 text-sm">
                      {!hostView && (
                        <div className="flex justify-between gap-3">
                          <dt className="text-slate-500">Anfitrión</dt>
                          <dd className="truncate font-medium">{visit.hostName}</dd>
                        </div>
                      )}
                      <div className="flex justify-between gap-3">
                        <dt className="text-slate-500">Entrada</dt>
                        <dd className="font-medium">
                          {formatDateTimeMx(visit.checkedInAt) || "—"}
                        </dd>
                      </div>
                      <div className="flex justify-between gap-3">
                        <dt className="text-slate-500">Lleva dentro</dt>
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
                        Registrar salida
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
