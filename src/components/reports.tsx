"use client";

import { useMemo, useState } from "react";
import {
  BarChart3,
  Clock3,
  Download,
  LogIn,
  Printer,
  SlidersHorizontal,
  Users,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useWorkspace } from "./workspace-provider";
import { Button, Card, EmptyState, Field, MetricTile, fieldClass } from "./ui";
import { Sheet } from "./ui-client";
import { safeCsvCell } from "@/lib/security";
import {
  formatDuration,
  statusLabels,
  timeInsideMs,
  type VisitStatus,
} from "@/lib/domain";

type Period = "daily" | "weekly" | "monthly";

const palette = ["#10cfc9", "#2563eb", "#071426", "#f59e0b", "#8b5cf6", "#059669"];

function isoDay(offsetDays: number) {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

export function Reports() {
  const { visits, organization } = useWorkspace();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filters, setFilters] = useState({
    from: isoDay(-30),
    to: isoDay(1),
    location: "all",
    host: "all",
    company: "all",
    purpose: "all",
    status: "all" as VisitStatus | "all",
  });
  const [period, setPeriod] = useState<Period>("daily");

  const options = useMemo(
    () => ({
      locations: [...new Set(visits.map((visit) => visit.location))].sort(),
      hosts: [...new Set(visits.map((visit) => visit.hostName))].sort(),
      companies: [...new Set(visits.map((visit) => visit.company).filter(Boolean))].sort(),
      purposes: [...new Set(visits.map((visit) => visit.purpose))].sort(),
    }),
    [visits],
  );

  const rows = useMemo(
    () =>
      visits.filter((visit) => {
        const day = visit.startsAt.slice(0, 10);
        return (
          day >= filters.from &&
          day <= filters.to &&
          (filters.location === "all" || visit.location === filters.location) &&
          (filters.host === "all" || visit.hostName === filters.host) &&
          (filters.company === "all" || visit.company === filters.company) &&
          (filters.purpose === "all" || visit.purpose === filters.purpose) &&
          (filters.status === "all" || visit.status === filters.status)
        );
      }),
    [visits, filters],
  );

  const stats = useMemo(() => {
    const entered = rows.filter((visit) => visit.checkedInAt);
    const completed = rows.filter(
      (visit) => visit.checkedInAt && visit.checkedOutAt,
    );
    const averageMs = completed.length
      ? completed.reduce((total, visit) => total + timeInsideMs(visit), 0) /
        completed.length
      : 0;

    const count = (key: (visit: (typeof rows)[number]) => string) =>
      Object.entries(
        rows.reduce<Record<string, number>>((acc, visit) => {
          const value = key(visit) || "Sin dato";
          acc[value] = (acc[value] ?? 0) + 1;
          return acc;
        }, {}),
      )
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value);

    const timeline = Object.entries(
      rows.reduce<Record<string, number>>((acc, visit) => {
        const date = new Date(visit.checkedInAt ?? visit.startsAt);
        let key = date.toISOString().slice(0, 10);
        if (period === "monthly") key = key.slice(0, 7);
        if (period === "weekly") {
          const monday = new Date(date);
          monday.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
          key = monday.toISOString().slice(0, 10);
        }
        acc[key] = (acc[key] ?? 0) + 1;
        return acc;
      }, {}),
    )
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => a.name.localeCompare(b.name));

    return {
      entered,
      averageMs,
      purposes: count((visit) => visit.purpose).slice(0, 6),
      hosts: count((visit) => visit.hostName).slice(0, 6),
      companies: count((visit) => visit.company).slice(0, 6),
      timeline,
    };
  }, [rows, period]);

  function exportCsv() {
    const content = [
      [
        "Visitante",
        "Empresa",
        "Anfitrión",
        "Ubicación",
        "Programada",
        "Entrada",
        "Salida",
        "Motivo",
        "Estado",
        "Duración (min)",
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
        visit.checkedInAt && visit.checkedOutAt
          ? Math.round(timeInsideMs(visit) / 60000)
          : "",
      ]),
    ]
      .map((row) => row.map(safeCsvCell).join(","))
      .join("\r\n");

    const blob = new Blob([`﻿${content}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `nexa-reporte-${filters.from}-a-${filters.to}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  const activeFilters = [
    filters.location,
    filters.host,
    filters.company,
    filters.purpose,
    filters.status,
  ].filter((value) => value !== "all").length;

  return (
    <>
      <header className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[13px] font-semibold text-[#0d9d99]">Analítica</p>
          <h1 className="mt-1.5 text-[26px] font-semibold tracking-[-.03em] sm:text-3xl">
            Reportes
          </h1>
          <p className="mt-1.5 text-[15px] text-slate-500">
            {rows.length} visitas entre {filters.from} y {filters.to}
          </p>
        </div>
        <div className="no-print flex gap-2">
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer size={16} />
            Imprimir
          </Button>
          <Button size="sm" onClick={exportCsv}>
            <Download size={16} />
            CSV
          </Button>
        </div>
      </header>

      <div className="no-print mb-5 flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setFiltersOpen(true)}
          className="relative"
        >
          <SlidersHorizontal size={16} />
          Filtros
          {activeFilters > 0 && (
            <span className="ml-1 grid size-5 place-items-center rounded-full bg-[#10cfc9] text-[11px] font-bold text-[#043b39]">
              {activeFilters}
            </span>
          )}
        </Button>
        {(["daily", "weekly", "monthly"] as Period[]).map((value) => (
          <Button
            key={value}
            size="sm"
            variant={period === value ? "primary" : "outline"}
            onClick={() => setPeriod(value)}
          >
            {value === "daily" ? "Diario" : value === "weekly" ? "Semanal" : "Mensual"}
          </Button>
        ))}
      </div>

      <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <MetricTile label="Visitas" value={rows.length} icon={BarChart3} tone="info" />
        <MetricTile
          label="Entradas registradas"
          value={stats.entered.length}
          icon={LogIn}
          tone="success"
        />
        <MetricTile
          label="Dentro ahora"
          value={rows.filter((visit) => visit.status === "checked_in").length}
          icon={Users}
          tone="accent"
        />
        <MetricTile
          label="Estancia promedio"
          value={stats.averageMs ? formatDuration(stats.averageMs) : "—"}
          icon={Clock3}
          tone="warning"
        />
      </section>

      {rows.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            icon={BarChart3}
            title="Sin datos en este rango"
            description="Amplía el periodo o quita algunos filtros."
          />
        </div>
      ) : (
        <section className="mt-5 grid gap-5 xl:grid-cols-2">
          <ChartCard
            title={`Visitas por periodo (${period === "daily" ? "día" : period === "weekly" ? "semana" : "mes"})`}
          >
            <BarChart data={stats.timeline}>
              <CartesianGrid vertical={false} stroke="#edf0f4" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} tickLine={false} />
              <YAxis allowDecimals={false} width={28} tick={{ fontSize: 11 }} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="value" fill="#2563eb" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ChartCard>

          <ChartCard title="Motivos más frecuentes">
            <BarChart data={stats.purposes} layout="vertical">
              <CartesianGrid horizontal={false} stroke="#edf0f4" />
              <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
              <YAxis
                type="category"
                dataKey="name"
                width={110}
                tick={{ fontSize: 11 }}
              />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="value" fill="#10aaa5" radius={[0, 8, 8, 0]} />
            </BarChart>
          </ChartCard>

          <ChartCard title="Empresas con más visitas">
            <BarChart data={stats.companies} layout="vertical">
              <CartesianGrid horizontal={false} stroke="#edf0f4" />
              <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
              <YAxis
                type="category"
                dataKey="name"
                width={110}
                tick={{ fontSize: 11 }}
              />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="value" fill="#071426" radius={[0, 8, 8, 0]} />
            </BarChart>
          </ChartCard>

          <ChartCard title="Visitas por anfitrión">
            <PieChart>
              <Pie
                data={stats.hosts}
                dataKey="value"
                nameKey="name"
                innerRadius={54}
                outerRadius={88}
                paddingAngle={2}
              >
                {stats.hosts.map((entry, index) => (
                  <Cell key={entry.name} fill={palette[index % palette.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} />
            </PieChart>
          </ChartCard>
        </section>
      )}

      <p className="mt-6 text-center text-xs text-slate-400">
        Datos de {organization.name} · generado el{" "}
        {new Intl.DateTimeFormat("es-MX", {
          dateStyle: "long",
          timeStyle: "short",
        }).format(new Date())}
      </p>

      <Sheet
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        title="Filtros del reporte"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Desde">
              <input
                type="date"
                className={fieldClass}
                value={filters.from}
                onChange={(event) =>
                  setFilters({ ...filters, from: event.target.value })
                }
              />
            </Field>
            <Field label="Hasta">
              <input
                type="date"
                className={fieldClass}
                value={filters.to}
                onChange={(event) =>
                  setFilters({ ...filters, to: event.target.value })
                }
              />
            </Field>
          </div>

          <SelectFilter
            label="Ubicación"
            value={filters.location}
            options={options.locations}
            onChange={(value) => setFilters({ ...filters, location: value })}
          />
          <SelectFilter
            label="Anfitrión"
            value={filters.host}
            options={options.hosts}
            onChange={(value) => setFilters({ ...filters, host: value })}
          />
          <SelectFilter
            label="Empresa"
            value={filters.company}
            options={options.companies}
            onChange={(value) => setFilters({ ...filters, company: value })}
          />
          <SelectFilter
            label="Motivo"
            value={filters.purpose}
            options={options.purposes}
            onChange={(value) => setFilters({ ...filters, purpose: value })}
          />

          <Field label="Estado">
            <select
              className={fieldClass}
              value={filters.status}
              onChange={(event) =>
                setFilters({
                  ...filters,
                  status: event.target.value as VisitStatus | "all",
                })
              }
            >
              <option value="all">Todos</option>
              {(
                [
                  "invited",
                  "pre_registered",
                  "checked_in",
                  "checked_out",
                  "denied",
                  "cancelled",
                ] as VisitStatus[]
              ).map((value) => (
                <option key={value} value={value}>
                  {statusLabels[value]}
                </option>
              ))}
            </select>
          </Field>

          <div className="flex gap-3 pt-2">
            <Button
              variant="outline"
              size="lg"
              className="flex-1"
              onClick={() =>
                setFilters({
                  from: isoDay(-30),
                  to: isoDay(1),
                  location: "all",
                  host: "all",
                  company: "all",
                  purpose: "all",
                  status: "all",
                })
              }
            >
              Limpiar
            </Button>
            <Button
              variant="accent"
              size="lg"
              className="flex-1"
              onClick={() => setFiltersOpen(false)}
            >
              Ver {rows.length} visitas
            </Button>
          </div>
        </div>
      </Sheet>
    </>
  );
}

const tooltipStyle = {
  borderRadius: 14,
  border: "1px solid #e3e9f2",
  fontSize: 13,
};

function ChartCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactElement;
}) {
  return (
    <Card className="p-5 sm:p-6">
      <h2 className="mb-4 font-semibold">{title}</h2>
      <div className="h-64 sm:h-72">
        <ResponsiveContainer width="100%" height="100%">
          {children}
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

function SelectFilter({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <Field label={label}>
      <select
        className={fieldClass}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="all">Todos</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </Field>
  );
}
