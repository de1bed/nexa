"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  BarChart3,
  BellRing,
  CalendarDays,
  Clock3,
  Link2,
  LogIn,
  LogOut,
  Plus,
  Send,
  ShieldX,
  UserRoundCheck,
} from "lucide-react";
import { toast } from "sonner";
import { useWorkspace, useMyVisits } from "./workspace-provider";
import { Avatar, Button, Card, EmptyState, MetricTile, StatusPill, Skeleton } from "./ui";
import { LiveDuration, ShareButton, Sheet } from "./ui-client";
import { eventLabels, type AccessEventType } from "@/lib/domain";

const activityIcon: Record<AccessEventType, typeof LogIn> = {
  check_in: LogIn,
  check_out: LogOut,
  denied: ShieldX,
  qr_scanned: UserRoundCheck,
  pre_registered: UserRoundCheck,
  invitation_created: Send,
  invitation_resent: Send,
  cancelled: ShieldX,
};

const activityTone: Record<AccessEventType, string> = {
  check_in: "text-emerald-600",
  check_out: "text-blue-600",
  denied: "text-red-600",
  qr_scanned: "text-slate-500",
  pre_registered: "text-[#0d9d99]",
  invitation_created: "text-slate-500",
  invitation_resent: "text-slate-500",
  cancelled: "text-amber-600",
};

const dateLabel = (value: string) =>
  new Intl.DateTimeFormat("es-MX", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));

export function HostDashboard() {
  const { events, viewer, loading, resendLink } = useWorkspace();
  const visits = useMyVisits();
  const [shareUrl, setShareUrl] = useState("");
  const [shareName, setShareName] = useState("");
  const [busyId, setBusyId] = useState("");

  const groups = useMemo(() => {
    const now = new Date();
    return {
      upcoming: visits
        .filter(
          (visit) =>
            new Date(visit.endsAt) >= now &&
            ["invited", "pre_registered", "approved"].includes(visit.status),
        )
        .sort(
          (a, b) =>
            new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
        ),
      inside: visits.filter((visit) => visit.status === "checked_in"),
      waiting: visits.filter((visit) => visit.status === "invited"),
    };
  }, [visits]);

  const activity = useMemo(
    () =>
      events
        .filter((event) => visits.some((visit) => visit.id === event.visitId))
        .slice(0, 6),
    [events, visits],
  );

  async function share(visitId: string, visitorName: string) {
    setBusyId(visitId);
    try {
      const url = await resendLink(visitId, "invitation", false);
      if (!url) throw new Error("No fue posible generar el enlace");
      setShareUrl(url);
      setShareName(visitorName);
    } catch (reason) {
      toast.error(
        reason instanceof Error ? reason.message : "No fue posible compartir",
      );
    } finally {
      setBusyId("");
    }
  }

  if (loading && visits.length === 0)
    return (
      <div className="space-y-4">
        <Skeleton className="h-9 w-52" />
        <Skeleton className="h-28" />
        <div className="grid gap-3 sm:grid-cols-3">
          {[0, 1, 2].map((key) => (
            <Skeleton key={key} className="h-32" />
          ))}
        </div>
      </div>
    );

  return (
    <>
      <header className="mb-6">
        <p className="text-[13px] font-semibold text-[#0d9d99]">
          Portal del anfitrión
        </p>
        <h1 className="mt-1.5 text-[26px] font-semibold tracking-[-.03em] sm:text-3xl">
          Hola, {viewer.name.split(" ")[0]}
        </h1>
        <p className="mt-1.5 text-[15px] text-slate-500">
          Comparte un enlace y tu visitante se registra solo.
        </p>
        <Link
          href="/app/reports"
          className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-blue-600"
        >
          <BarChart3 size={16} />
          Abrir mis reportes
        </Link>
      </header>

      <Link href="/app/visits/new" className="block">
        <div className="dark-panel flex items-center gap-4 rounded-[26px] p-5 text-white transition active:scale-[.99]">
          <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-[#10cfc9] text-[#043b39]">
            <Plus size={28} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-lg font-semibold">Invitar a alguien</p>
            <p className="mt-0.5 text-sm text-slate-300">
              Toma 30 segundos. El visitante completa el resto.
            </p>
          </div>
          <ArrowUpRight size={22} className="shrink-0 text-slate-400" />
        </div>
      </Link>

      {groups.inside.length > 0 && (
        <section className="mt-5 rounded-[26px] border border-emerald-200 bg-emerald-50 p-5">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-emerald-100 text-emerald-700">
                <BellRing size={20} />
              </span>
              <div>
                <h2 className="font-semibold text-emerald-950">
                  {groups.inside.length === 1
                    ? "Tu visitante ya está dentro"
                    : `${groups.inside.length} visitantes dentro ahora`}
                </h2>
                <p className="text-sm text-emerald-800/80">
                  Aforo de tus invitados, actualizado en vivo.
                </p>
              </div>
            </div>
            <Link
              href="/app/people-on-site"
              className="shrink-0 text-sm font-medium text-emerald-800"
            >
              Ver todos
            </Link>
          </div>
          <div className="space-y-2">
            {groups.inside.map((visit) => (
              <Link
                key={visit.id}
                href={`/app/visits/${visit.id}`}
                className="flex items-center gap-3 rounded-2xl bg-white p-3"
              >
                <Avatar name={visit.visitorName} size={38} tone="accent" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">
                    {visit.visitorName}
                  </p>
                  <p className="truncate text-xs text-slate-500">
                    {visit.company || "Sin empresa"} · {visit.location}
                    {visit.checkedInAt
                      ? ` · desde ${dateLabel(visit.checkedInAt)}`
                      : ""}
                  </p>
                </div>
                <LiveDuration
                  since={visit.checkedInAt}
                  className="shrink-0 text-xs font-medium text-emerald-700"
                />
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="mt-5 grid grid-cols-3 gap-3">
        <MetricTile
          label="Próximas"
          value={groups.upcoming.length}
          icon={CalendarDays}
          tone="info"
        />
        <MetricTile
          label="Sin registrar"
          value={groups.waiting.length}
          icon={Clock3}
          tone="warning"
        />
        <MetricTile
          label="Dentro"
          value={groups.inside.length}
          icon={UserRoundCheck}
          tone="success"
        />
      </section>

      <section className="mt-6 grid gap-5 xl:grid-cols-[1.4fr_1fr]">
        <Card className="p-0">
          <div className="flex items-center justify-between border-b border-slate-100 p-5">
            <div>
              <h2 className="font-semibold">Mis próximas visitas</h2>
              <p className="text-sm text-slate-500">
                Solo las invitaciones creadas por ti
              </p>
            </div>
            <Link
              href="/app/visits"
              className="shrink-0 text-sm font-medium text-blue-600"
            >
              Ver todas
            </Link>
          </div>

          {groups.upcoming.length === 0 ? (
            <div className="p-5">
              <EmptyState
                icon={CalendarDays}
                title="No tienes visitas próximas"
                description="Crea una invitación y compártela por WhatsApp o correo."
                action={
                  <Link href="/app/visits/new">
                    <Button variant="accent">
                      <Plus size={18} />
                      Nueva invitación
                    </Button>
                  </Link>
                }
              />
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {groups.upcoming.slice(0, 8).map((visit) => (
                <li key={visit.id} className="flex items-center gap-3 p-4">
                  <Link
                    href={`/app/visits/${visit.id}`}
                    className="flex min-w-0 flex-1 items-center gap-3"
                  >
                    <Avatar name={visit.visitorName} size={42} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="truncate font-semibold">
                          {visit.visitorName}
                        </span>
                        <StatusPill status={visit.status} />
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-slate-500">
                        {dateLabel(visit.startsAt)} · {visit.location}
                      </span>
                    </span>
                  </Link>
                  {visit.status === "invited" && (
                    <button
                      type="button"
                      onClick={() => share(visit.id, visit.visitorName)}
                      disabled={busyId === visit.id}
                      aria-label={`Compartir enlace de ${visit.visitorName}`}
                      className="grid size-11 shrink-0 place-items-center rounded-2xl border border-slate-200 text-slate-600 active:bg-slate-50 disabled:opacity-50"
                    >
                      <Send size={17} />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="p-5">
          <h2 className="font-semibold">Actividad de mis visitas</h2>
          {activity.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500">
              Aquí verás cuándo se registran y llegan tus visitantes.
            </p>
          ) : (
            <div className="mt-4 space-y-2.5">
              {activity.map((event) => {
                const visit = visits.find((item) => item.id === event.visitId);
                const Icon = activityIcon[event.type];
                return (
                  <div
                    key={event.id}
                    className="flex gap-3 rounded-2xl bg-slate-50 p-3"
                  >
                    <Icon
                      size={18}
                      className={`mt-0.5 shrink-0 ${activityTone[event.type]}`}
                    />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {visit?.visitorName ?? "Visita"}
                      </p>
                      <p className="text-xs text-slate-500">
                        {eventLabels[event.type]} · {dateLabel(event.at)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </section>

      <Sheet
        open={Boolean(shareUrl)}
        onClose={() => setShareUrl("")}
        title="Compartir invitación"
        description={`Envía este enlace a ${shareName}. Al abrirlo completará su registro y recibirá su pase.`}
      >
        <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-3">
          <Link2 size={18} className="shrink-0 text-slate-400" />
          <span className="min-w-0 flex-1 truncate text-sm text-slate-600">
            {shareUrl}
          </span>
        </div>
        <div className="mt-4">
          <ShareButton
            url={shareUrl}
            title="Invitación de visita"
            text={`Hola ${shareName}, completa tu registro para tu visita:`}
            className="w-full"
          />
        </div>
      </Sheet>
    </>
  );
}
