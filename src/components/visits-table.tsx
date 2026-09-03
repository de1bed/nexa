"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CalendarDays, Download, Plus, Search, SlidersHorizontal } from "lucide-react";
import { useWorkspace, useMyVisits } from "./workspace-provider";
import {
  Avatar,
  Button,
  Card,
  EmptyState,
  StatusPill,
  cn,
  fieldClass,
} from "./ui";
import { LiveDuration } from "./ui-client";
import { safeCsvCell } from "@/lib/security";
import { statusLabels, type VisitStatus } from "@/lib/domain";

const shortDate = (value: string) =>
  new Intl.DateTimeFormat("es-MX", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));

const filterable: VisitStatus[] = [
  "invited",
  "pre_registered",
  "checked_in",
  "checked_out",
  "denied",
  "cancelled",
];

export function VisitsTable() {
  const { viewer, loading } = useWorkspace();
  const allVisits = useMyVisits();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<VisitStatus | "all">("all");

  const isHost = viewer.role === "host";

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return allVisits.filter((visit) => {
      if (status !== "all" && visit.status !== status) return false;
      if (!needle) return true;
      return [visit.visitorName, visit.company, visit.hostName, visit.purpose, visit.location]
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
  }, [allVisits, query, status]);

  function exportCsv() {
    const content = [
      [
        "Visitante",
        "Empresa",
        "Anfitrión",
        "Ubicación",
        "Inicio",
        "Entrada",
        "Salida",
        "Motivo",
        "Estado",
        "Origen",
      ],
      ...rows.map((visit) => [
        visit.visitorName,
        visit.company,
        visit.hostName,
        visit.location,
        visit.startsAt,
        visit.checkedInAt ?? "",
        visit.checkedOutAt ?? "",
        visit.purpose,
        statusLabels[visit.status],
        visit.origin === "guard_manual" ? "Registro en caseta" : "Invitación",
      ]),
    ]
      .map((row) => row.map(safeCsvCell).join(","))
      .join("\r\n");

    const blob = new Blob([`﻿${content}`], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `nexa-visitas-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <header className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[13px] font-semibold text-[#0d9d99]">
            {isHost ? "Portal del anfitrión" : "Operación"}
          </p>
          <h1 className="mt-1.5 text-[26px] font-semibold tracking-[-.03em] sm:text-3xl">
            {isHost ? "Mis visitas" : "Visitas"}
          </h1>
          <p className="mt-1.5 text-[15px] text-slate-500">
            {isHost
              ? "Consulta y administra únicamente tus invitaciones."
              : "Historial completo de accesos de la organización."}
          </p>
        </div>
        <Link href="/app/visits/new" className="hidden lg:block">
          <Button>
            <Plus size={17} />
            Nueva invitación
          </Button>
        </Link>
      </header>

      <div className="mb-4 space-y-3">
        <label className="relative block">
          <Search
            size={18}
            className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            aria-label="Buscar visitas"
            placeholder="Buscar visitante, empresa o anfitrión…"
            className={cn(fieldClass, "pl-11")}
          />
        </label>

        <div className="hide-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <FilterChip
            active={status === "all"}
            onClick={() => setStatus("all")}
            label="Todas"
            count={allVisits.length}
          />
          {filterable.map((value) => {
            const count = allVisits.filter((visit) => visit.status === value).length;
            if (count === 0 && status !== value) return null;
            return (
              <FilterChip
                key={value}
                active={status === value}
                onClick={() => setStatus(value)}
                label={statusLabels[value]}
                count={count}
              />
            );
          })}
          <button
            onClick={exportCsv}
            className="ml-auto inline-flex h-10 shrink-0 items-center gap-2 rounded-full border border-slate-200 bg-white px-4 text-sm font-medium text-slate-600"
          >
            <Download size={16} />
            CSV
          </button>
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={query || status !== "all" ? SlidersHorizontal : CalendarDays}
          title={
            query || status !== "all"
              ? "Sin resultados"
              : "Todavía no hay visitas"
          }
          description={
            query || status !== "all"
              ? "Cambia la búsqueda o quita los filtros."
              : "Crea tu primera invitación y compártela con el visitante."
          }
          action={
            !query && status === "all" ? (
              <Link href="/app/visits/new">
                <Button variant="accent">
                  <Plus size={18} />
                  Nueva invitación
                </Button>
              </Link>
            ) : undefined
          }
        />
      ) : (
        <>
          {/* Móvil: tarjetas tocables */}
          <div className="space-y-2.5 lg:hidden">
            {rows.map((visit) => (
              <Link key={visit.id} href={`/app/visits/${visit.id}`}>
                <Card className="flex items-center gap-3 p-4 transition active:scale-[.99]">
                  <Avatar name={visit.visitorName} size={44} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate font-semibold">{visit.visitorName}</p>
                      <StatusPill status={visit.status} />
                    </div>
                    <p className="mt-0.5 truncate text-xs text-slate-500">
                      {visit.company || "Sin empresa"} · {visit.hostName}
                    </p>
                    <p className="mt-1 truncate text-xs text-slate-400">
                      {shortDate(visit.startsAt)}
                      {visit.status === "checked_in" && (
                        <>
                          {" · "}
                          <LiveDuration since={visit.checkedInAt} prefix="dentro " />
                        </>
                      )}
                    </p>
                  </div>
                </Card>
              </Link>
            ))}
          </div>

          {/* Escritorio: tabla densa */}
          <Card className="hidden overflow-hidden p-0 lg:block">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    {[
                      "Visitante",
                      "Anfitrión",
                      "Programada",
                      "Entrada / salida",
                      "Motivo",
                      "Estado",
                      "Origen",
                    ].map((header) => (
                      <th key={header} className="px-5 py-3 font-medium">
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((visit) => (
                    <tr key={visit.id} className="hover:bg-slate-50">
                      <td className="px-5 py-4">
                        <Link
                          href={`/app/visits/${visit.id}`}
                          className="font-semibold hover:text-blue-600"
                        >
                          {visit.visitorName}
                        </Link>
                        <p className="text-xs text-slate-500">{visit.company}</p>
                      </td>
                      <td className="px-5 py-4">{visit.hostName}</td>
                      <td className="px-5 py-4">{shortDate(visit.startsAt)}</td>
                      <td className="px-5 py-4 text-xs text-slate-600">
                        {visit.checkedInAt ? shortDate(visit.checkedInAt) : "—"} /{" "}
                        {visit.checkedOutAt ? shortDate(visit.checkedOutAt) : "—"}
                      </td>
                      <td className="px-5 py-4">{visit.purpose}</td>
                      <td className="px-5 py-4">
                        <StatusPill status={visit.status} />
                      </td>
                      <td className="px-5 py-4 text-xs">
                        {visit.origin === "guard_manual" ? "Caseta" : "Invitación"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}

      <p className="mt-4 text-center text-sm text-slate-500">
        {loading ? "Sincronizando…" : `${rows.length} de ${allVisits.length} visitas`}
      </p>
    </>
  );
}

function FilterChip({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full px-4 text-sm font-medium transition",
        active
          ? "bg-[#071426] text-white"
          : "border border-slate-200 bg-white text-slate-600",
      )}
    >
      {label}
      <span className={cn("text-xs", active ? "text-white/60" : "text-slate-400")}>
        {count}
      </span>
    </button>
  );
}

