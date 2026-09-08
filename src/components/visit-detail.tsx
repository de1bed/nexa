/* eslint-disable @next/next/no-img-element */
"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  BadgeCheck,
  CalendarClock,
  Car,
  Eye,
  FileWarning,
  Link2,
  MapPin,
  QrCode,
  ShieldCheck,
  Ticket,
  UserRound,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { useWorkspace } from "./workspace-provider";
import {
  Avatar,
  Button,
  Callout,
  Card,
  EmptyState,
  StatusPill,
  cn,
} from "./ui";
import { LiveDuration, Sheet, ShareButton } from "./ui-client";
import { eventLabels, formatDuration, timeInsideMs } from "@/lib/domain";

const fullDate = (value: string) =>
  new Intl.DateTimeFormat("es-MX", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));

export function VisitDetail({ id }: { id: string }) {
  const { visits, events, viewer, cancelVisit, resendLink, live } = useWorkspace();
  const [share, setShare] = useState<{ url: string; kind: "invitation" | "pass" } | null>(
    null,
  );
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [busy, setBusy] = useState("");
  const [documents, setDocuments] = useState<
    Array<{ id: string; url: string; label: string }>
  >([]);
  const [brokenDocs, setBrokenDocs] = useState<string[]>([]);

  const visit = visits.find((item) => item.id === id);
  const timeline = useMemo(
    () =>
      events
        .filter((event) => event.visitId === id)
        .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()),
    [events, id],
  );

  if (!visit)
    return (
      <EmptyState
        icon={FileWarning}
        title="Visita no encontrada"
        description="Puede que se haya cancelado o que no tengas acceso a ella."
        action={
          <Link href="/app/visits">
            <Button variant="outline">Volver a visitas</Button>
          </Link>
        }
      />
    );

  const canManage =
    viewer.role !== "host" || visit.hostId === viewer.id;
  const isOpen = !["cancelled", "checked_out", "denied", "expired"].includes(
    visit.status,
  );

  async function link(kind: "invitation" | "pass") {
    setBusy(kind);
    try {
      const url = await resendLink(id, kind, false);
      if (!url) throw new Error("No fue posible generar el enlace");
      setShare({ url, kind });
    } catch (reason) {
      toast.error(
        reason instanceof Error ? reason.message : "No fue posible generar el enlace",
      );
    } finally {
      setBusy("");
    }
  }

  async function viewDocument() {
    setBusy("document");
    try {
      const response = await fetch(`/api/visits/${id}/document`);
      const payload = (await response.json()) as {
        documents?: Array<{ id: string; url: string; label: string }>;
        error?: string;
      };
      if (!response.ok || !payload.documents?.length)
        throw new Error(payload.error ?? "No fue posible abrir el documento");
      setDocuments(payload.documents);
    } catch (reason) {
      toast.error(
        reason instanceof Error ? reason.message : "No fue posible abrir el documento",
      );
    } finally {
      setBusy("");
    }
  }

  return (
    <>
      <Link
        href="/app/visits"
        className="mb-5 inline-flex items-center gap-2 text-sm text-slate-500"
      >
        <ArrowLeft size={16} />
        Volver a visitas
      </Link>

      <Card className="p-5 sm:p-6">
        <div className="flex items-start gap-4">
          <Avatar name={visit.visitorName} size={56} tone="dark" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-[24px] font-semibold leading-tight tracking-[-.02em]">
                {visit.visitorName}
              </h1>
              <StatusPill status={visit.status} />
            </div>
            <p className="mt-1 text-sm text-slate-500">
              {visit.company || "Sin empresa"}
            </p>
            {visit.email && (
              <p className="mt-0.5 truncate text-sm text-slate-500">{visit.email}</p>
            )}
          </div>
        </div>

        {visit.status === "checked_in" && (
          <div className="mt-4 flex items-center justify-between rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
            <span>Dentro de las instalaciones</span>
            <LiveDuration since={visit.checkedInAt} />
          </div>
        )}
        {visit.status === "checked_out" && visit.checkedInAt && (
          <div className="mt-4 flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3 text-sm font-medium text-slate-600">
            <span>Duración de la visita</span>
            <span>{formatDuration(timeInsideMs(visit))}</span>
          </div>
        )}
        {visit.status === "denied" && visit.denialReason && (
          <Callout tone="danger" icon={AlertTriangle} className="mt-4">
            <b>Acceso denegado:</b> {visit.denialReason}
          </Callout>
        )}
      </Card>

      {canManage && isOpen && (
        <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
          <Button
            variant="accent"
            size="lg"
            disabled={busy === "invitation"}
            onClick={() => link("invitation")}
          >
            <Link2 size={18} />
            {visit.status === "invited"
              ? timeline.some((e) => e.type === "invitation_resent")
                ? "Volver a compartir enlace"
                : "Compartir enlace de registro"
              : "Nuevo enlace de registro"}
          </Button>
          {visit.status !== "invited" && (
            <Button
              variant="outline"
              size="lg"
              disabled={busy === "pass"}
              onClick={() => link("pass")}
            >
              <Ticket size={18} />
              Reenviar pase QR
            </Button>
          )}
        </div>
      )}

      <div className="mt-5 grid gap-5 lg:grid-cols-[1.3fr_1fr]">
        <Card className="p-5 sm:p-6">
          <h2 className="mb-5 font-semibold">Detalles de la visita</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Detail
              icon={CalendarClock}
              label="Fecha y horario"
              value={`${fullDate(visit.startsAt)} — ${new Intl.DateTimeFormat("es-MX", { timeStyle: "short" }).format(new Date(visit.endsAt))}`}
            />
            <Detail
              icon={MapPin}
              label="Ubicación"
              value={visit.location}
              hint={visit.locationAddress}
            />
            <Detail icon={UserRound} label="Anfitrión" value={visit.hostName} />
            <Detail icon={ShieldCheck} label="Motivo" value={visit.purpose} />
            {visit.vehiclePlate && (
              <Detail icon={Car} label="Placas" value={visit.vehiclePlate} />
            )}
            <Detail
              icon={visit.documentCaptured ? BadgeCheck : FileWarning}
              label="Identificación"
              value={
                visit.documentCaptured
                  ? `${visit.documentType ?? "Documento"} ${visit.documentMasked ?? ""}`.trim()
                  : "No capturada"
              }
            />
          </div>

          {visit.notes && (
            <div className="mt-5 rounded-2xl bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-400">
                Notas internas
              </p>
              <p className="mt-1 text-sm">{visit.notes}</p>
            </div>
          )}
          {visit.visitorNotes && (
            <div className="mt-3 rounded-2xl bg-blue-50 p-4">
              <p className="text-xs uppercase tracking-wide text-blue-500">
                Nota del visitante
              </p>
              <p className="mt-1 text-sm text-blue-900">{visit.visitorNotes}</p>
            </div>
          )}
          {visit.accessRequirements && (
            <Callout tone="warning" icon={AlertTriangle} className="mt-3">
              <b>Requisitos de acceso:</b> {visit.accessRequirements}
            </Callout>
          )}

          {live && visit.documentCaptured && viewer.role !== "host" && (
            <Button
              variant="outline"
              className="mt-5"
              disabled={busy === "document"}
              onClick={viewDocument}
            >
              <Eye size={17} />
              Ver identificación
            </Button>
          )}

          {canManage && isOpen && (
            <Button
              variant="outline"
              className="mt-3 border-red-200 text-red-600"
              onClick={() => setConfirmCancel(true)}
            >
              <XCircle size={17} />
              Cancelar visita
            </Button>
          )}
        </Card>

        <Card className="p-5 sm:p-6">
          <h2 className="mb-5 font-semibold">Cronología</h2>
          <ol className="space-y-5">
            {timeline.map((event) => (
              <li key={event.id} className="flex gap-3">
                <span className="mt-1.5 size-2 shrink-0 rounded-full bg-[#10cfc9] ring-4 ring-cyan-50" />
                <div className="min-w-0">
                  <p className="text-sm font-medium">{eventLabels[event.type]}</p>
                  <p className="text-xs text-slate-500">
                    {fullDate(event.at)} · {event.actor}
                  </p>
                  {event.detail && (
                    <p className="mt-1 text-xs text-red-600">{event.detail}</p>
                  )}
                </div>
              </li>
            ))}
            <li className="flex gap-3">
              <span className="mt-1.5 size-2 shrink-0 rounded-full bg-slate-300 ring-4 ring-slate-50" />
              <div>
                <p className="text-sm font-medium">Invitación creada</p>
                <p className="text-xs text-slate-500">Por {visit.hostName}</p>
              </div>
            </li>
          </ol>
        </Card>
      </div>

      <Sheet
        open={Boolean(share)}
        onClose={() => setShare(null)}
        title={
          share?.kind === "pass" ? "Pase de acceso" : "Enlace de registro"
        }
        description={
          share?.kind === "pass"
            ? "Este pase sustituye a cualquier código anterior de esta visita."
            : "Con este enlace el visitante completa sus datos y recibe su pase. El enlace anterior queda invalidado."
        }
      >
        <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-3">
          <QrCode size={18} className="shrink-0 text-slate-400" />
          <span className="min-w-0 flex-1 truncate text-sm text-slate-600">
            {share?.url}
          </span>
        </div>
        <div className="mt-4">
          {share && (
            <ShareButton
              url={share.url}
              title={
                share.kind === "pass" ? "Tu pase de acceso" : "Invitación de visita"
              }
              text={`Hola ${visit.visitorName}:`}
              className="w-full"
            />
          )}
        </div>
      </Sheet>

      <Sheet
        open={confirmCancel}
        onClose={() => setConfirmCancel(false)}
        title="¿Cancelar esta visita?"
        description="Se revocarán el enlace de registro y el pase QR. El visitante no podrá entrar."
      >
        <div className="flex gap-3">
          <Button
            variant="outline"
            size="lg"
            className="flex-1"
            onClick={() => setConfirmCancel(false)}
          >
            Conservar
          </Button>
          <Button
            variant="danger"
            size="lg"
            className="flex-1"
            disabled={busy === "cancel"}
            onClick={async () => {
              setBusy("cancel");
              try {
                await cancelVisit(id);
                toast.success("Visita cancelada");
                setConfirmCancel(false);
              } catch (reason) {
                toast.error(
                  reason instanceof Error
                    ? reason.message
                    : "No fue posible cancelar",
                );
              } finally {
                setBusy("");
              }
            }}
          >
            Cancelar visita
          </Button>
        </div>
      </Sheet>

      <Sheet
        open={documents.length > 0}
        onClose={() => setDocuments([])}
        title="Identificación"
        description="Enlaces temporales de 60 segundos. La consulta queda auditada."
      >
        <div className="space-y-4">
          {documents.map((document) => (
            <figure key={document.id}>
              <figcaption className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
                {document.label}
              </figcaption>
              {brokenDocs.includes(document.id) ? (
                <p className="rounded-2xl bg-red-50 p-3 text-sm text-red-700">
                  No se pudo mostrar la imagen. Cierra y vuelve a abrir.
                </p>
              ) : (
                <img
                  src={document.url}
                  alt={`${document.label} de la identificación del visitante`}
                  className="min-h-40 w-full rounded-2xl border border-slate-200 bg-slate-50 object-contain"
                  referrerPolicy="no-referrer"
                  onError={() =>
                    setBrokenDocs((current) => [...current, document.id])
                  }
                />
              )}
            </figure>
          ))}
        </div>
      </Sheet>
    </>
  );
}

function Detail({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: typeof MapPin;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="flex gap-3">
      <span className={cn("grid size-10 shrink-0 place-items-center rounded-xl bg-slate-50 text-slate-500")}>
        <Icon size={18} />
      </span>
      <div className="min-w-0">
        <p className="text-xs text-slate-500">{label}</p>
        <p className="mt-0.5 text-sm font-medium leading-5">{value}</p>
        {hint && <p className="mt-0.5 text-xs text-slate-400">{hint}</p>}
      </div>
    </div>
  );
}
