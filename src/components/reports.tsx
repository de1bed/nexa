"use client";
import { useMemo, useState } from "react";
import { useDemo } from "./demo-provider";
import { safeCsvCell } from "@/lib/security";
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
import { Download, Printer } from "lucide-react";
import type { VisitStatus } from "@/lib/domain";
export function Reports() {
  const { state } = useDemo();
  const [from, setFrom] = useState("2020-01-01");
  const [to, setTo] = useState("2099-12-31");
  const [location, setLocation] = useState("all");
  const [host, setHost] = useState("all");
  const [company, setCompany] = useState("all");
  const [status, setStatus] = useState<VisitStatus | "all">("all");
  const [purpose, setPurpose] = useState("all");
  const [period, setPeriod] = useState<"daily" | "weekly" | "monthly">("daily");
  const options = useMemo(
    () => ({
      locations: [...new Set(state.visits.map((v) => v.location))].sort(),
      hosts: [...new Set(state.visits.map((v) => v.hostName))].sort(),
      companies: [...new Set(state.visits.map((v) => v.company))].sort(),
      purposes: [...new Set(state.visits.map((v) => v.purpose))].sort(),
    }),
    [state.visits],
  );
  const rows = useMemo(
    () =>
      state.visits.filter(
        (v) =>
          v.startsAt.slice(0, 10) >= from &&
          v.startsAt.slice(0, 10) <= to &&
          (location === "all" || v.location === location) &&
          (host === "all" || v.hostName === host) &&
          (company === "all" || v.company === company) &&
          (status === "all" || v.status === status) &&
          (purpose === "all" || v.purpose === purpose),
      ),
    [state.visits, from, to, location, host, company, status, purpose],
  );
  const reasons = Object.entries(
    rows.reduce<Record<string, number>>(
      (a, v) => ({ ...a, [v.purpose]: (a[v.purpose] ?? 0) + 1 }),
      {},
    ),
  ).map(([name, value]) => ({ name, value }));
  const hosts = Object.entries(
    rows.reduce<Record<string, number>>(
      (a, v) => ({ ...a, [v.hostName]: (a[v.hostName] ?? 0) + 1 }),
      {},
    ),
  ).map(([name, value]) => ({ name, value }));
  const companies = Object.entries(
    rows.reduce<Record<string, number>>(
      (a, v) => ({ ...a, [v.company]: (a[v.company] ?? 0) + 1 }),
      {},
    ),
  )
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 6);
  const summary = Object.entries(
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
  ).map(([name, value]) => ({ name, value }));
  const checked = rows.filter((v) => v.checkedInAt);
  const durations = rows
    .filter((v) => v.checkedOutAt && v.checkedInAt)
    .map(
      (v) =>
        (new Date(v.checkedOutAt!).getTime() -
          new Date(v.checkedInAt!).getTime()) /
        60000,
    );
  const avg = Math.round(
    durations.reduce((a, b) => a + b, 0) / (durations.length || 1),
  );
  function csv() {
    const text = [
      ["Visitante", "Empresa", "Anfitrión", "Fecha", "Estado", "Duración min"],
      ...rows.map((v) => [
        v.visitorName,
        v.company,
        v.hostName,
        v.startsAt,
        v.status,
        v.checkedInAt && v.checkedOutAt
          ? Math.round(
              (new Date(v.checkedOutAt).getTime() -
                new Date(v.checkedInAt).getTime()) /
                60000,
            )
          : "",
      ]),
    ]
      .map((r) => r.map(safeCsvCell).join(","))
      .join("\r\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob(["\ufeff" + text]));
    a.download = `reporte-${from}-${to}.csv`;
    a.click();
  }
  return (
    <>
      <header className="mb-8">
        <p className="mb-2 text-sm font-medium text-[#0eaaa5]">Analítica</p>
        <h1 className="text-3xl font-semibold tracking-[-.03em]">Reportes</h1>
        <p className="mt-2 text-slate-500">
          Las métricas reflejan exclusivamente los datos demostrativos visibles.
        </p>
      </header>
      <div className="mb-6 grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-4">
        <label className="text-sm">
          <span className="mb-1 block text-slate-500">Desde</span>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="h-11 rounded-xl border border-slate-200 px-3"
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-slate-500">Hasta</span>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="h-11 rounded-xl border border-slate-200 px-3"
          />
        </label>
        <Filter label="Ubicación" value={location} setValue={setLocation} options={options.locations} />
        <Filter label="Anfitrión" value={host} setValue={setHost} options={options.hosts} />
        <Filter label="Empresa" value={company} setValue={setCompany} options={options.companies} />
        <Filter label="Motivo" value={purpose} setValue={setPurpose} options={options.purposes} />
        <label className="text-sm"><span className="mb-1 block text-slate-500">Estado</span><select value={status} onChange={(e) => setStatus(e.target.value as VisitStatus | "all")} className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3"><option value="all">Todos</option><option value="invited">Invitadas</option><option value="pre_registered">Preregistradas</option><option value="checked_in">Dentro</option><option value="checked_out">Salida registrada</option><option value="denied">Denegadas</option><option value="cancelled">Canceladas</option></select></label>
        <label className="text-sm"><span className="mb-1 block text-slate-500">Resumen</span><select value={period} onChange={(e) => setPeriod(e.target.value as typeof period)} className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3"><option value="daily">Diario</option><option value="weekly">Semanal</option><option value="monthly">Mensual</option></select></label>
        <div className="flex gap-2 sm:col-span-2 lg:col-span-4 lg:justify-end">
        <button
          onClick={() => print()}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border px-4 text-sm font-medium"
        >
          <Printer size={17} />
          Imprimir
        </button>
        </div>
        <button
          onClick={csv}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#071426] px-4 text-sm font-medium text-white"
        >
          <Download size={17} />
          Exportar CSV
        </button>
      </div>
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["Visitas", rows.length],
          ["Entradas", checked.length],
          ["Dentro", rows.filter((v) => v.status === "checked_in").length],
          ["Duración promedio", `${avg} min`],
        ].map(([a, b]) => (
          <div
            key={a}
            className="rounded-2xl border border-slate-200 bg-white p-5"
          >
            <p className="text-sm text-slate-500">{a}</p>
            <p className="mt-2 text-2xl font-semibold">{b}</p>
          </div>
        ))}
      </section>
      <section className="mt-6 grid gap-6 lg:grid-cols-2">
        <ChartCard title={`Resumen ${period === "daily" ? "diario" : period === "weekly" ? "semanal" : "mensual"}`}>
          <ResponsiveContainer width="100%" height="100%"><BarChart data={summary}><CartesianGrid vertical={false} stroke="#edf0f4"/><XAxis dataKey="name" tick={{fontSize: 10}}/><YAxis allowDecimals={false}/><Tooltip/><Bar dataKey="value" fill="#2563eb" radius={6}/></BarChart></ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Motivos más frecuentes">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={reasons} layout="vertical">
              <CartesianGrid horizontal={false} stroke="#edf0f4" />
              <XAxis type="number" allowDecimals={false} />
              <YAxis
                type="category"
                dataKey="name"
                width={120}
                tick={{ fontSize: 11 }}
              />
              <Tooltip />
              <Bar dataKey="value" fill="#10aaa5" radius={6} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Empresas con más visitas">
          <ResponsiveContainer width="100%" height="100%"><BarChart data={companies} layout="vertical"><CartesianGrid horizontal={false} stroke="#edf0f4"/><XAxis type="number" allowDecimals={false}/><YAxis type="category" dataKey="name" width={120} tick={{fontSize: 11}}/><Tooltip/><Bar dataKey="value" fill="#071426" radius={6}/></BarChart></ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Visitas por anfitrión">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={hosts}
                dataKey="value"
                nameKey="name"
                innerRadius={55}
                outerRadius={90}
              >
                {hosts.map((_, i) => (
                  <Cell
                    key={i}
                    fill={["#10cfc9", "#2563eb", "#071426"][i % 3]}
                  />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
      </section>
    </>
  );
}
function Filter({ label, value, setValue, options }: { label: string; value: string; setValue: (value: string) => void; options: string[] }) {
  return <label className="text-sm"><span className="mb-1 block text-slate-500">{label}</span><select value={value} onChange={(e) => setValue(e.target.value)} className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3"><option value="all">Todos</option>{options.map((option) => <option key={option}>{option}</option>)}</select></label>;
}
function ChartCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6">
      <h2 className="mb-4 font-semibold">{title}</h2>
      <div className="h-72">{children}</div>
    </div>
  );
}
