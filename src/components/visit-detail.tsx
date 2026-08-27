"use client";
import Link from "next/link";
import { useDemo } from "./demo-provider";
import { StatusPill } from "./status-pill";
import {
  ArrowLeft,
  Calendar,
  Copy,
  MapPin,
  ShieldCheck,
  UserRound,
  XCircle,
} from "lucide-react";
import { useState } from "react";
export function VisitDetail({ id, hostOnly = false }: { id: string; hostOnly?: boolean }) {
  const { state, updateVisit, production } = useDemo();
  const [copied, setCopied] = useState(false);
  const v = state.visits.find((x) => x.id === id && (!hostOnly || production || x.hostName === "Mateo García"));
  if (!v)
    return (
      <div className="rounded-2xl bg-white p-10 text-center">
        <h1 className="text-xl font-semibold">Visita no encontrada</h1>
        <Link href="/app/visits" className="mt-4 inline-block text-blue-600">
          Volver
        </Link>
      </div>
    );
  const activeVisit = v;
  const format = (x: string) =>
    new Intl.DateTimeFormat("es-MX", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(x));
  async function copy() {
    let token = activeVisit.invitationToken;
    if (production && !token) {
      const response = await fetch(`/api/visits/${activeVisit.id}/resend`, {
        method: "POST",
      });
      const result = (await response.json()) as { invitationToken?: string };
      if (!response.ok || !result.invitationToken) return;
      token = result.invitationToken;
    }
    if (!token) return;
    const link = `${window.location.origin}/visit/${token}`;
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }
  return (
    <>
      <Link
        href="/app/visits"
        className="mb-6 inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900"
      >
        <ArrowLeft size={16} />
        Volver a visitas
      </Link>
      <header className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <div className="mb-3 flex items-center gap-3">
            <StatusPill status={v.status} />
            <span className="text-xs text-slate-400">{v.id}</span>
          </div>
          <h1 className="text-3xl font-semibold tracking-[-.03em]">
            {v.visitorName}
          </h1>
          <p className="mt-2 text-slate-500">{v.company}</p>
        </div>
        <div className="flex gap-2">
          {!["cancelled", "checked_out"].includes(v.status) && (
            <button
              onClick={() => updateVisit(v.id, { status: "cancelled" })}
              className="inline-flex h-11 items-center gap-2 rounded-xl border border-red-200 px-4 text-sm font-medium text-red-600"
            >
              <XCircle size={17} />
              Cancelar
            </button>
          )}
          <button
            onClick={copy}
            className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#071426] px-4 text-sm font-medium text-white"
          >
            <Copy size={17} />
            {copied
              ? "Copiado"
              : production
                ? "Reenviar enlace"
                : "Copiar enlace"}
          </button>
        </div>
      </header>
      <div className="grid gap-6 lg:grid-cols-[1.2fr_.8fr]">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-6 font-semibold">Detalles de la visita</h2>
          <div className="grid gap-5 sm:grid-cols-2">
            {[
              [
                Calendar,
                "Fecha y horario",
                `${format(v.startsAt)} — ${new Intl.DateTimeFormat("es-MX", { timeStyle: "short" }).format(new Date(v.endsAt))}`,
              ],
              [MapPin, "Ubicación", v.location],
              [UserRound, "Anfitrión", v.hostName],
              [ShieldCheck, "Motivo", v.purpose],
            ].map(([Icon, label, value]) => (
              <div key={String(label)} className="flex gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-slate-50 text-slate-500">
                  <Icon size={18} />
                </span>
                <div>
                  <p className="text-xs text-slate-500">{String(label)}</p>
                  <p className="mt-1 text-sm font-medium">{String(value)}</p>
                </div>
              </div>
            ))}
          </div>
          {v.notes && (
            <div className="mt-6 rounded-xl bg-slate-50 p-4">
              <p className="text-xs text-slate-500">Notas internas</p>
              <p className="mt-1 text-sm">{v.notes}</p>
            </div>
          )}
        </section>
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-5 font-semibold">Cronología</h2>
          <div className="space-y-5">
            {state.events
              .filter((e) => e.visitId === v.id)
              .map((e) => (
                <div key={e.id} className="flex gap-3">
                  <span className="mt-1 size-2 rounded-full bg-[#10cfc9] ring-4 ring-cyan-50" />
                  <div>
                    <p className="text-sm font-medium">
                      {e.type.replaceAll("_", " ")}
                    </p>
                    <p className="text-xs text-slate-500">
                      {format(e.at)} · {e.actor}
                    </p>
                  </div>
                </div>
              ))}
            <div className="flex gap-3">
              <span className="mt-1 size-2 rounded-full bg-slate-300 ring-4 ring-slate-50" />
              <div>
                <p className="text-sm font-medium">Invitación creada</p>
                <p className="text-xs text-slate-500">Por {v.hostName}</p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
