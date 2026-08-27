"use client";

import Link from "next/link";
import { ArrowUpRight, BellRing, CalendarDays, CheckCircle2, Clock3, UserRoundCheck } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useDemo } from "./demo-provider";
import { StatusPill } from "./status-pill";

const hostName = "Mateo García";
const date = (value: string) =>
  new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
const eventLabels: Record<string, string> = {
  invitation_created: "Invitación creada",
  pre_registered: "Preregistro completado",
  qr_scanned: "Pase escaneado",
  check_in: "Entrada registrada",
  check_out: "Salida registrada",
  denied: "Acceso denegado",
};

export function HostDashboard() {
  const { state, production } = useDemo();
  const visits = production ? state.visits : state.visits.filter((visit) => visit.hostName === hostName);
  const displayName = production ? visits[0]?.hostName ?? "Anfitrión" : hostName;
  const upcoming = visits.filter((visit) => new Date(visit.endsAt) >= new Date() && !["cancelled", "denied", "checked_out"].includes(visit.status));
  const inside = visits.filter((visit) => visit.status === "checked_in");
  const pending = visits.filter((visit) => visit.status === "invited");
  const activity = state.events
    .filter((event) => visits.some((visit) => visit.id === event.visitId))
    .slice(0, 6);
  const cards: Array<[string, number, LucideIcon, string]> = [
    ["Próximas", upcoming.length, CalendarDays, "bg-blue-50 text-blue-600"],
    ["Esperan preregistro", pending.length, Clock3, "bg-amber-50 text-amber-600"],
    ["Mis visitantes dentro", inside.length, UserRoundCheck, "bg-emerald-50 text-emerald-600"],
  ];

  return <>
    <header className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div><p className="mb-2 text-sm font-medium text-[#0eaaa5]">Portal del anfitrión</p><h1 className="text-3xl font-semibold tracking-[-.03em]">Hola, {displayName.split(" ")[0]}</h1><p className="mt-2 text-slate-500">Prepara tus próximas visitas y recibe a quienes ya llegaron.</p></div>
      <Link href="/app/visits/new" className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#071426] px-5 text-sm font-semibold text-white">Nueva invitación <ArrowUpRight size={17}/></Link>
    </header>
    <section className="grid gap-4 sm:grid-cols-3">
      {cards.map(([label,value,Icon,color]) => <article key={label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><span className={`grid size-10 place-items-center rounded-xl ${color}`}><Icon size={19}/></span><p className="mt-4 text-3xl font-semibold">{value}</p><p className="mt-1 text-sm text-slate-500">{label}</p></article>)}
    </section>
    {inside.length > 0 && <section className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-5"><div className="flex items-start gap-3"><BellRing className="mt-0.5 text-emerald-700"/><div><h2 className="font-semibold text-emerald-950">{inside.length === 1 ? "Tu visitante ya llegó" : "Tus visitantes ya llegaron"}</h2><p className="mt-1 text-sm text-emerald-800">{inside.map((visit) => visit.visitorName).join(", ")} {inside.length === 1 ? "está" : "están"} en las instalaciones.</p></div></div></section>}
    <section className="mt-6 grid gap-6 xl:grid-cols-[1.4fr_1fr]">
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="flex items-center justify-between border-b border-slate-100 p-5"><div><h2 className="font-semibold">Mis próximas visitas</h2><p className="text-sm text-slate-500">Solo invitaciones creadas por ti</p></div><Link href="/app/visits" className="text-sm font-medium text-blue-600">Ver todas</Link></div><div className="divide-y divide-slate-100">{upcoming.slice(0,6).map((visit) => <Link key={visit.id} href={`/app/visits/${visit.id}` as never} className="flex items-center gap-4 p-5 hover:bg-slate-50"><span className="grid size-11 place-items-center rounded-full bg-slate-100 font-semibold">{visit.visitorName.split(" ").map((part) => part[0]).slice(0,2)}</span><span className="min-w-0 flex-1"><span className="block truncate font-semibold">{visit.visitorName}</span><span className="block truncate text-xs text-slate-500">{visit.company} · {date(visit.startsAt)}</span></span><StatusPill status={visit.status}/></Link>)}{upcoming.length === 0 && <div className="py-14 text-center text-sm text-slate-500">No tienes visitas próximas.</div>}</div></div>
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="font-semibold">Actividad de mis visitas</h2><div className="mt-4 space-y-3">{activity.map((event) => {const visit=visits.find((item)=>item.id===event.visitId);return <div key={event.id} className="flex gap-3 rounded-xl bg-slate-50 p-3"><CheckCircle2 size={18} className="mt-0.5 text-[#0eaaa5]"/><div><p className="text-sm font-medium">{visit?.visitorName}</p><p className="text-xs text-slate-500">{eventLabels[event.type] ?? event.type} · {date(event.at)}</p></div></div>})}</div></div>
    </section>
  </>;
}
