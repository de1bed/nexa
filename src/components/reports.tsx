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
import { useMyVisits, useWorkspace } from "./workspace-provider";
import { Button, Card, EmptyState, Field, MetricTile, fieldClass } from "./ui";
import { LiveDuration, Sheet, useNow } from "./ui-client";
import { safeCsvCell } from "@/lib/security";
import {
  formatDateTimeMx,
  formatDuration,
  statusLabels,
  timeInsideMs,
  type Visit,
  type VisitStatus,
} from "@/lib/domain";

type Period = "daily" | "weekly" | "monthly";

const palette = ["#10cfc9", "#2563eb", "#071426", "#f59e0b", "#8b5cf6", "#059669"];

function isoDay(offsetDays: number) {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

function downloadCsv(filename: string, lines: string[][]) {
  const content = lines.map((row) => row.map(safeCsvCell).join(",")).join("\r\n");
  const blob = new Blob([`\uFEFF${content}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function stayLabel(visit: Visit) {
  if (!visit.checkedInAt) return "—";
  return formatDuration(timeInsideMs(visit));
}

export function Reports() {
  const { organization, viewer, syncedAt, live } = useWorkspace();
  const visits = useMyVisits();
  const hostView = viewer.role === "host";
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

  const scoped = useMemo(
    () =>
      visits.filter((visit) => {
        return (
          (filters.location === "all" || visit.location === filters.location) &&
          (filters.host === "all" || visit.hostName === filters.host) &&
          (filters.company === "all" || visit.company === filters.company)
        );
      }),
    [visits, filters.location, filters.host, filters.company],
  );

  const insideNow = useMemo(
    () =>
      scoped
        .filter((visit) => visit.status === "checked_in")
        .sort(
          (a, b) =>
            new Date(a.checkedInAt ?? a.startsAt).getTime() -
            new Date(b.checkedInAt ?? b.startsAt).getTime(),
        ),
    [scoped],
  );

  const rows = useMemo(
    () =>
      scoped.filter((visit) => {
        const day = visit.startsAt.slice(0, 10);
        return (
          day >= filters.from &&
          day <= filters.to &&
          (filters.purpose === "all" || visit.purpose === filters.purpose) &&
          (filters.status === "all" || visit.status === filters.status)
        );
      }),
    [scoped, filters.from, filters.to, filters.purpose, filters.status],
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

    const count = (key: (visit: Visit) => string) =>
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

  const clock = useNow();
  const generatedAt = formatDateTimeMx(
    syncedAt ?? (clock ? new Date(clock).toISOString() : undefined),
  );
  const periodLabel = `${filters.from} a ${filters.to}`;

  function exportCsv() {
    const header = [
      ["Organización", organization.name],
      ["Tipo de reporte", hostView ? "Bitácora del anfitrión" : "Bitácora de control de visitas"],
      ["Generado", generatedAt],
      ["Periodo", periodLabel],
      ["Personas dentro ahora", String(insideNow.length)],
      ["Visitas en el periodo", String(rows.length)],
      [],
      ["PERSONAS DENTRO AHORA"],
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
      ...insideNow.map((visit) => [
        visit.visitorName,
        visit.company || "Sin empresa",
        visit.hostName,
        visit.location,
        visit.purpose,
        formatDateTimeMx(visit.checkedInAt),
        stayLabel(visit),
        visit.documentMasked || (visit.documentCaptured ? "Capturada" : "No capturada"),
      ]),
      [],
      ["BITÁCORA DEL PERIODO"],
      [
        "Visitante",
        "Empresa",
        "Anfitrión",
        "Ubicación",
        "Motivo",
        "Programada inicio",
        "Programada fin",
        "Entrada",
        "Salida",
        "Estancia",
        "Estado",
        "Identificación",
        "Placas",
      ],
      ...rows.map((visit) => [
        visit.visitorName,
        visit.company || "Sin empresa",
        visit.hostName,
        visit.location,
        visit.purpose,
        formatDateTimeMx(visit.startsAt),
        formatDateTimeMx(visit.endsAt),
        formatDateTimeMx(visit.checkedInAt),
        formatDateTimeMx(visit.checkedOutAt),
        stayLabel(visit),
        statusLabels[visit.status],
        visit.documentMasked || (visit.documentCaptured ? "Capturada" : "No capturada"),
        visit.vehiclePlate || "",
      ]),
    ];

    downloadCsv(
      `nexa-bitacora-${organization.name.replace(/\s+/g, "-").toLowerCase()}-${filters.from}-a-${filters.to}.csv`,
      header,
    );
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
          <p className="text-[13px] font-semibold text-[#0d9d99]">
            Control de acceso
          </p>
          <h1 className="mt-1.5 text-[26px] font-semibold tracking-[-.03em] sm:text-3xl">
            {hostView ? "Mis reportes" : "Reportes de auditoría"}
          </h1>
          <p className="mt-1.5 max-w-2xl text-[15px] text-slate-500">
            Bitácora de {organization.name}
            {hostView ? " · solo tus visitas" : ""}. Personas dentro en este
            momento, independiente del periodo.
          </p>
        </div>
        <div className="no-print flex gap-2">
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer size={16} />
            Imprimir
          </Button>
          <Button size="sm" onClick={exportCsv}>
            <Download size={16} />
            Exportar CSV
          </Button>
        </div>
      </header>

      <Card className="mb-5 border-[#10cfc9]/30 bg-white p-5 print:border print:border-slate-300">
        <p className="text-[11px] font-semibold uppercase tracking-[.18em] text-[#0d9d99]">
          NEXA VISIT
        </p>
        <h2 className="mt-1 text-xl font-semibold">{organization.name}</h2>
        <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <dt className="text-slate-400">Documento</dt>
            <dd className="font-medium">Bitácora de visitas</dd>
          </div>
          <div>
            <dt className="text-slate-400">Periodo</dt>
            <dd className="font-medium">{periodLabel}</dd>
          </div>
          <div>
            <dt className="text-slate-400">Generado</dt>
            <dd className="font-medium">{generatedAt}</dd>
          </div>
          <div>
            <dt className="text-slate-400">Responsable</dt>
            <dd className="font-medium">{viewer.name}</dd>
          </div>
        </dl>
        {live && (
          <p className="mt-3 text-xs text-slate-400">
            Esta vista se actualiza sola cada 20 segundos.
          </p>
        )}
      </Card>

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
        <MetricTile label="Visitas del periodo" value={rows.length} icon={BarChart3} tone="info" />
        <MetricTile
          label="Entradas registradas"
          value={stats.entered.length}
          icon={LogIn}
          tone="success"
        />
        <MetricTile
          label="Dentro ahora"
          value={insideNow.length}
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

      <section className="mt-6">
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Personas dentro ahora</h2>
            <p className="text-sm text-slate-500">
              Aforo en vivo. No depende del rango de fechas.
            </p>
          </div>
          <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
            {insideNow.length} presente{insideNow.length === 1 ? "" : "s"}
          </span>
        </div>

        {insideNow.length === 0 ? (
          <EmptyState
            icon={Users}
            title="Nadie está dentro"
            description="Cuando caseta registre una entrada, la persona aparecerá aquí al instante."
          />
        ) : (
          <AuditTable
            visits={insideNow}
            mode="inside"
          />
        )}
      </section>

      <section className="mt-8">
        <div className="mb-3">
          <h2 className="text-lg font-semibold">Bitácora del periodo</h2>
          <p className="text-sm text-slate-500">
            {rows.length} visita{rows.length === 1 ? "" : "s"} entre {filters.from} y{" "}
            {filters.to}
          </p>
        </div>

        {rows.length === 0 ? (
          <EmptyState
            icon={BarChart3}
            title="Sin datos en este rango"
            description="Amplía el periodo o quita algunos filtros."
          />
        ) : (
          <AuditTable visits={rows} mode="log" />
        )}
      </section>

      {rows.length > 0 && (
        <section className="no-print mt-8 grid gap-5 xl:grid-cols-2">
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

      <p className="mt-8 text-center text-xs text-slate-400">
        {organization.name} · generado {generatedAt} · para uso en auditorías de
        control de acceso
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
          {!hostView && (
            <SelectFilter
              label="Anfitrión"
              value={filters.host}
              options={options.hosts}
              onChange={(value) => setFilters({ ...filters, host: value })}
            />
          )}
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

function AuditTable({
  visits,
  mode,
}: {
  visits: Visit[];
  mode: "inside" | "log";
}) {
  return (
    <Card className="overflow-hidden p-0">
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3 font-semibold">Visitante</th>
              <th className="px-4 py-3 font-semibold">Empresa</th>
              <th className="px-4 py-3 font-semibold">Anfitrión</th>
              <th className="px-4 py-3 font-semibold">Ubicación</th>
              {mode === "log" && (
                <th className="px-4 py-3 font-semibold">Programada</th>
              )}
              <th className="px-4 py-3 font-semibold">Entrada</th>
              {mode === "log" && (
                <th className="px-4 py-3 font-semibold">Salida</th>
              )}
              <th className="px-4 py-3 font-semibold">Estancia</th>
              {mode === "log" && (
                <th className="px-4 py-3 font-semibold">Estado</th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {visits.map((visit) => (
              <tr key={visit.id} className="align-top">
                <td className="px-4 py-3">
                  <p className="font-semibold">{visit.visitorName}</p>
                  <p className="text-xs text-slate-400">{visit.purpose}</p>
                </td>
                <td className="px-4 py-3 text-slate-600">
                  {visit.company || "Sin empresa"}
                </td>
                <td className="px-4 py-3">{visit.hostName}</td>
                <td className="px-4 py-3">{visit.location}</td>
                {mode === "log" && (
                  <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                    {formatDateTimeMx(visit.startsAt)}
                  </td>
                )}
                <td className="whitespace-nowrap px-4 py-3">
                  {formatDateTimeMx(visit.checkedInAt) || "—"}
                </td>
                {mode === "log" && (
                  <td className="whitespace-nowrap px-4 py-3">
                    {formatDateTimeMx(visit.checkedOutAt) || "—"}
                  </td>
                )}
                <td className="whitespace-nowrap px-4 py-3 font-medium text-emerald-800">
                  {mode === "inside" && visit.checkedInAt ? (
                    <LiveDuration since={visit.checkedInAt} />
                  ) : (
                    stayLabel(visit)
                  )}
                </td>
                {mode === "log" && (
                  <td className="whitespace-nowrap px-4 py-3">
                    {statusLabels[visit.status]}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
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
