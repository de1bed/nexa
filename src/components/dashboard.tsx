"use client";

import { useMemo } from "react";
import Link from "next/link";
import {
  Activity,
  ArrowUpRight,
  CalendarDays,
  Clock3,
  LogIn,
  LogOut,
  ScanLine,
  ShieldX,
  UserRoundCheck,
  Users,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useWorkspace } from "./workspace-provider";
import { Avatar, Button, Card, EmptyState, MetricTile, StatusPill, Skeleton } from "./ui";
import { LiveDuration } from "./ui-client";
import { eventLabels, formatDuration, timeInsideMs } from "@/lib/domain";

const time = (value: string) =>
  new Intl.DateTimeFormat("es-MX", { hour: "2-digit", minute: "2-digit" }).format(
    new Date(value),
  );

export function Dashboard() {
  const { visits, events, viewer, organization, loading } = useWorkspace();

  const metrics = useMemo(() => {
    const today = new Date().toDateString();
    const isToday = (value?: string) =>
      Boolean(value) && new Date(value!).toDateString() === today;

    const inside = visits.filter((visit) => visit.status === "checked_in");
    const scheduledToday = visits.filter((visit) => isToday(visit.startsAt));
    const exitsToday = visits.filter((visit) => isToday(visit.checkedOutAt));

    const completed = visits.filter(
      (visit) => visit.checkedInAt && visit.checkedOutAt,
    );
    const averageMs = completed.length
      ? completed.reduce((total, visit) => total + timeInsideMs(visit), 0) /
        completed.length
      : 0;

    const chart = Array.from({ length: 7 }, (_, index) => {
      const day = new Date();
      day.setDate(day.getDate() - 6 + index);
      const label = day.toDateString();
      const sameDay = visits.filter(
        (visit) => new Date(visit.startsAt).toDateString() === label,
      );
      return {
        day: new Intl.DateTimeFormat("es-MX", { weekday: "short" }).format(day),
        entradas: sameDay.filter((visit) => visit.checkedInAt).length,
        salidas: sameDay.filter((visit) => visit.checkedOutAt).length,
      };
    });

    return {
      inside,
      scheduledToday,
      exitsToday,
      averageMs,
      chart,
    };
  }, [visits]);

  const upcoming = useMemo(
    () =>
      visits
        .filter(
          (visit) =>
            new Date(visit.startsAt) > new Date() &&
            ["invited", "pre_registered", "approved"].includes(visit.status),
        )
        .sort(
          (a, b) =>
            new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
        )
        .slice(0, 5),
    [visits],
  );

  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Buenos días" : hour < 19 ? "Buenas tardes" : "Buenas noches";

  if (loading && visits.length === 0)
    return (
      <div className="space-y-4">
        <Skeleton className="h-9 w-56" />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((key) => (
            <Skeleton key={key} className="h-32" />
          ))}
        </div>
        <Skeleton className="h-72" />
      </div>
    );

  return (
    <>
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[13px] font-medium text-[#0d9d99] first-letter:uppercase">
            {new Intl.DateTimeFormat("es-MX", {
              weekday: "long",
              day: "numeric",
              month: "long",
            }).format(new Date())}
          </p>
          <h1 className="mt-1.5 text-[26px] font-semibold tracking-[-.03em] sm:text-3xl">
            {greeting}, {viewer.name.split(" ")[0]}
          </h1>
          <p className="mt-1.5 text-[15px] text-slate-500">
            Esto es lo que está pasando en {organization.name}.
          </p>
        </div>
        <div className="hidden gap-2 lg:flex">
          <Link href="/guard/scan">
            <Button variant="outline">
              <ScanLine size={17} />
              Abrir caseta
            </Button>
          </Link>
          <Link href="/app/visits/new">
            <Button>
              Nueva invitación
              <ArrowUpRight size={17} />
            </Button>
          </Link>
        </div>
      </header>

      <div className="mb-5 grid gap-3 sm:grid-cols-2">
        <Link
          href="/app/team"
          className="flex items-center gap-4 rounded-[22px] border border-[#10cfc9]/30 bg-[#10cfc9]/10 p-4 transition active:scale-[.99]"
        >
          <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-[#071426] text-white">
            <Users size={22} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-semibold">Invita a tu equipo</span>
            <span className="mt-0.5 block text-sm text-slate-600">
              Anfitriones y guardias entran con un correo.
            </span>
          </span>
          <ArrowUpRight size={18} className="shrink-0 text-slate-400" />
        </Link>
        <Link
          href="/guard/scan"
          className="flex items-center gap-4 rounded-[22px] border border-slate-200 bg-white p-4 transition active:scale-[.99]"
        >
          <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-[#071426] text-white">
            <ScanLine size={22} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-semibold">Abrir caseta</span>
            <span className="mt-0.5 block text-sm text-slate-600">
              Escanea pases y controla entradas como en recepción.
            </span>
          </span>
          <ArrowUpRight size={18} className="shrink-0 text-slate-400" />
        </Link>
      </div>

      <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <MetricTile
          label="Dentro ahora"
          value={metrics.inside.length}
          icon={Users}
          tone="success"
        />
        <MetricTile
          label="Programadas hoy"
          value={metrics.scheduledToday.length}
          icon={CalendarDays}
          tone="info"
        />
        <MetricTile
          label="Salidas hoy"
          value={metrics.exitsToday.length}
          icon={LogOut}
          tone="neutral"
        />
        <MetricTile
          label="Estancia promedio"
          value={
            metrics.averageMs ? formatDuration(metrics.averageMs) : "Sin datos"
          }
          icon={Clock3}
          tone="accent"
        />
      </section>

      {metrics.inside.length > 0 && (
        <section className="mt-6">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold">Dentro de las instalaciones</h2>
            <Link
              href="/app/people-on-site"
              className="text-sm font-medium text-blue-600"
            >
              Ver todas
            </Link>
          </div>
          <div className="hide-scrollbar -mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-1 sm:mx-0 sm:grid sm:grid-cols-2 sm:px-0 xl:grid-cols-3">
            {metrics.inside.slice(0, 6).map((visit) => (
              <Card
                key={visit.id}
                className="w-[248px] shrink-0 snap-start sm:w-auto"
              >
                <div className="flex items-center gap-3">
                  <Avatar name={visit.visitorName} tone="accent" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{visit.visitorName}</p>
                    <p className="truncate text-xs text-slate-500">
                      {visit.company || visit.hostName}
                    </p>
                  </div>
                </div>
                <div className="mt-4 flex items-center justify-between rounded-xl bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-800">
                  <span className="flex items-center gap-1.5">
                    <Clock3 size={14} />
                    <LiveDuration since={visit.checkedInAt} />
                  </span>
                  <span>desde {visit.checkedInAt ? time(visit.checkedInAt) : "—"}</span>
                </div>
              </Card>
            ))}
          </div>
        </section>
      )}

      <section className="mt-6 grid gap-5 xl:grid-cols-[1.55fr_1fr]">
        <Card className="p-5 sm:p-6">
          <div className="mb-5">
            <h2 className="font-semibold">Flujo de la semana</h2>
            <p className="text-sm text-slate-500">Entradas y salidas registradas</p>
          </div>
          <div className="h-60 sm:h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={metrics.chart}>
                <defs>
                  <linearGradient id="entradas" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor="#10cfc9" stopOpacity={0.35} />
                    <stop offset="1" stopColor="#10cfc9" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e8edf4" />
                <XAxis
                  dataKey="day"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12 }}
                />
                <YAxis
                  allowDecimals={false}
                  axisLine={false}
                  tickLine={false}
                  width={28}
                  tick={{ fontSize: 12 }}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: 14,
                    border: "1px solid #e3e9f2",
                    fontSize: 13,
                  }}
                />
                <Area
                  dataKey="entradas"
                  type="monotone"
                  stroke="#0d9d99"
                  fill="url(#entradas)"
                  strokeWidth={2.4}
                />
                <Area
                  dataKey="salidas"
                  type="monotone"
                  stroke="#2563eb"
                  fill="transparent"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-5 sm:p-6">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="font-semibold">Próximas visitas</h2>
              <p className="text-sm text-slate-500">Agenda inmediata</p>
            </div>
            <Activity size={18} className="text-slate-400" />
          </div>
          {upcoming.length === 0 ? (
            <EmptyState
              icon={CalendarDays}
              title="Sin visitas próximas"
              description="Cuando alguien programe una invitación aparecerá aquí."
            />
          ) : (
            <div className="space-y-1">
              {upcoming.map((visit) => (
                <Link
                  key={visit.id}
                  href={`/app/visits/${visit.id}`}
                  className="flex items-center gap-3 rounded-2xl p-2.5 transition hover:bg-slate-50"
                >
                  <Avatar name={visit.visitorName} size={40} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">
                      {visit.visitorName}
                    </span>
                    <span className="block truncate text-xs text-slate-500">
                      {visit.hostName} · {time(visit.startsAt)}
                    </span>
                  </span>
                  <StatusPill status={visit.status} />
                </Link>
              ))}
            </div>
          )}
        </Card>
      </section>

      <section className="mt-6">
        <Card className="p-5 sm:p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold">Actividad reciente</h2>
            <Link href="/app/visits" className="text-sm font-medium text-blue-600">
              Ver todo
            </Link>
          </div>
          {events.length === 0 ? (
            <EmptyState
              icon={Activity}
              title="Sin movimientos todavía"
              description="El registro de entradas y salidas se mostrará aquí."
            />
          ) : (
            <div className="grid gap-2.5 md:grid-cols-2">
              {events.slice(0, 6).map((event) => {
                const visit = visits.find((item) => item.id === event.visitId);
                const Icon =
                  event.type === "check_in"
                    ? LogIn
                    : event.type === "check_out"
                      ? LogOut
                      : event.type === "denied"
                        ? ShieldX
                        : UserRoundCheck;
                return (
                  <div
                    key={event.id}
                    className="flex items-center gap-3 rounded-2xl border border-slate-100 p-3"
                  >
                    <span className="grid size-9 shrink-0 place-items-center rounded-full bg-cyan-50 text-cyan-700">
                      <Icon size={16} />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {visit?.visitorName ?? "Visita"}
                      </p>
                      <p className="truncate text-xs text-slate-500">
                        {eventLabels[event.type]} · {time(event.at)} ·{" "}
                        {event.actor}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </section>
    </>
  );
}
