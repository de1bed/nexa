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
  Images,
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
import { StaffPassPanel } from "./staff-pass";
import { timeInsideMs } from "@/lib/domain";
import { documentTypeMessageKey, visitPurposeMessageKey } from "@/lib/i18n";
import { useI18n } from "./i18n-provider";

export function VisitDetail({ id }: { id: string }) {
  const { visits, events, viewer, cancelVisit, resendLink, live, organization } =
    useWorkspace();
  const { t, formatDateTime, formatTime, formatDuration } = useI18n();
  const [share, setShare] = useState<{ url: string; kind: "invitation" | "pass" } | null>(
    null,
  );
  const [passNonce, setPassNonce] = useState(0);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [busy, setBusy] = useState("");
  const [documents, setDocuments] = useState<
    Array<{ id: string; url: string; label: string; kind?: string }>
  >([]);
  const [documentFilter, setDocumentFilter] = useState<
    "identification" | "vehicle" | "attachment" | "all"
  >("all");
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
        title={t("visits.notFound")}
        description={t("visits.notFoundHint")}
        action={
          <Link href="/app/visits">
            <Button variant="outline">{t("visits.back")}</Button>
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
      if (!url) throw new Error(t("visits.linkFail"));
      setShare({ url, kind });
      if (kind === "pass") setPassNonce((value) => value + 1);
    } catch (reason) {
      toast.error(
        reason instanceof Error ? reason.message : t("visits.linkFail"),
      );
    } finally {
      setBusy("");
    }
  }

  async function viewDocument(
    filter: "identification" | "vehicle" | "attachment" | "all" = "all",
  ) {
    setBusy("document");
    try {
      const response = await fetch(`/api/visits/${id}/document`);
      const payload = (await response.json()) as {
        documents?: Array<{
          id: string;
          url: string;
          label: string;
          kind?: string;
        }>;
        error?: string;
      };
      if (!response.ok || !payload.documents?.length)
        throw new Error(payload.error ?? t("visits.documentFail"));
      setDocumentFilter(filter);
      setDocuments(payload.documents);
    } catch (reason) {
      toast.error(
        reason instanceof Error ? reason.message : t("visits.documentFail"),
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
        {t("visits.back")}
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
              {visit.company || t("common.noCompany")}
            </p>
            {visit.email && (
              <p className="mt-0.5 truncate text-sm text-slate-500">{visit.email}</p>
            )}
          </div>
        </div>

        {visit.status === "checked_in" && (
          <div className="mt-4 flex items-center justify-between rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
            <span>{t("dashboard.currentlyInside")}</span>
            <LiveDuration since={visit.checkedInAt} />
          </div>
        )}
        {visit.status === "checked_out" && visit.checkedInAt && (
          <div className="mt-4 flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3 text-sm font-medium text-slate-600">
            <span>{t("visits.visitDuration")}</span>
            <span>{formatDuration(timeInsideMs(visit))}</span>
          </div>
        )}
        {visit.status === "denied" && visit.denialReason && (
          <Callout tone="danger" icon={AlertTriangle} className="mt-4">
            <b>{t("visits.deniedLabel")}</b> {visit.denialReason}
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
                ? t("visits.shareAgain")
                : t("visits.shareRegister")
              : t("visits.newRegisterLink")}
          </Button>
          {visit.status !== "invited" && (
            <Button
              variant="outline"
              size="lg"
              disabled={busy === "pass"}
              onClick={() => link("pass")}
            >
              <Ticket size={18} />
              {t("visits.newPass")}
            </Button>
          )}
        </div>
      )}

      {["pre_registered", "approved", "checked_in", "checked_out"].includes(
        visit.status,
      ) && (
        <StaffPassPanel
          key={`${visit.id}-${passNonce}`}
          visitId={visit.id}
          visitorName={visit.visitorName}
          organizationName={organization.name}
          hostName={visit.hostName}
          location={visit.location}
          startsAt={visit.startsAt}
          endsAt={visit.endsAt}
        />
      )}

      <div className="mt-5 grid gap-5 lg:grid-cols-[1.3fr_1fr]">
        <Card className="p-5 sm:p-6">
          <h2 className="mb-5 font-semibold">{t("visits.details")}</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Detail
              icon={CalendarClock}
              label={t("visits.schedule")}
              value={`${formatDateTime(visit.startsAt)} — ${formatTime(visit.endsAt)}`}
            />
            <Detail
              icon={MapPin}
              label={t("visits.location")}
              value={visit.location}
              hint={visit.locationAddress}
            />
            <Detail icon={UserRound} label={t("visits.host")} value={visit.hostName} />
            <Detail
              icon={ShieldCheck}
              label={t("invite.purpose")}
              value={t(visitPurposeMessageKey(visit.purpose)) || visit.purpose}
            />
            {visit.vehiclePlate && (
              <Detail icon={Car} label={t("visits.plates")} value={visit.vehiclePlate} />
            )}
            <Detail
              icon={(visit.identityCaptured ?? visit.documentCaptured) ? BadgeCheck : FileWarning}
              label={t("visits.identification")}
              value={
                (visit.identityCaptured ?? visit.documentCaptured)
                  ? `${t(documentTypeMessageKey(visit.documentType ?? "") || "people.document") || visit.documentType || t("people.document")} ${visit.documentMasked ?? ""}`.trim()
                  : t("visits.notCaptured")
              }
            />
            {visit.vehiclePhotosCaptured && (
              <Detail icon={Car} label={t("visits.platePhotos")} value={t("visits.captured")} />
            )}
            {visit.attachmentsCaptured && (
              <Detail icon={Images} label={t("visits.attachments")} value={t("visits.attachmentsCaptured")} />
            )}
          </div>

          {visit.notes && (
            <div className="mt-5 rounded-2xl bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-400">
                {t("visits.internalNotes")}
              </p>
              <p className="mt-1 text-sm">{visit.notes}</p>
            </div>
          )}
          {visit.visitorNotes && (
            <div className="mt-3 rounded-2xl bg-blue-50 p-4">
              <p className="text-xs uppercase tracking-wide text-blue-500">
                {t("visits.visitorNote")}
              </p>
              <p className="mt-1 text-sm text-blue-900">{visit.visitorNotes}</p>
            </div>
          )}
          {visit.accessRequirements && (
            <Callout tone="warning" icon={AlertTriangle} className="mt-3">
              <b>{t("visits.accessReq")}</b> {visit.accessRequirements}
            </Callout>
          )}

          {live &&
            (viewer.role !== "host" || visit.hostId === viewer.id) &&
            (visit.identityCaptured ||
              visit.vehiclePhotosCaptured ||
              visit.attachmentsCaptured ||
              visit.documentCaptured) && (
            <div className="mt-5 flex flex-wrap gap-2">
              {(visit.identityCaptured ??
                (!visit.vehiclePhotosCaptured &&
                  !visit.attachmentsCaptured &&
                  visit.documentCaptured)) && (
                <Button
                  variant="outline"
                  disabled={busy === "document"}
                  onClick={() => viewDocument("identification")}
                >
                  <Eye size={17} />
                  {t("visits.viewId")}
                </Button>
              )}
              {visit.vehiclePhotosCaptured && (
                <Button
                  variant="outline"
                  disabled={busy === "document"}
                  onClick={() => viewDocument("vehicle")}
                >
                  <Eye size={17} />
                  {t("visits.viewPlates")}
                </Button>
              )}
              {visit.attachmentsCaptured && (
                <Button
                  variant="outline"
                  disabled={busy === "document"}
                  onClick={() => viewDocument("attachment")}
                >
                  <Eye size={17} />
                  {t("visits.viewAttachments")}
                </Button>
              )}
              {!visit.identityCaptured &&
                !visit.vehiclePhotosCaptured &&
                !visit.attachmentsCaptured &&
                visit.documentCaptured && (
                  <Button
                    variant="outline"
                    disabled={busy === "document"}
                    onClick={() => viewDocument("all")}
                  >
                    <Eye size={17} />
                    {t("visits.viewDocs")}
                  </Button>
                )}
            </div>
          )}

          {canManage && isOpen && (
            <Button
              variant="outline"
              className="mt-3 border-red-200 text-red-600"
              onClick={() => setConfirmCancel(true)}
            >
              <XCircle size={17} />
              {t("visits.cancelVisit")}
            </Button>
          )}
        </Card>

        <Card className="p-5 sm:p-6">
            <h2 className="mb-5 font-semibold">{t("visits.timeline")}</h2>
          <ol className="space-y-5">
            {timeline.map((event) => (
              <li key={event.id} className="flex gap-3">
                <span className="mt-1.5 size-2 shrink-0 rounded-full bg-[#10cfc9] ring-4 ring-cyan-50" />
                <div className="min-w-0">
                  <p className="text-sm font-medium">{t(`events.${event.type}`)}</p>
                  <p className="text-xs text-slate-500">
                    {formatDateTime(event.at)} · {event.actor}
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
                <p className="text-sm font-medium">{t("visits.invitationCreated")}</p>
                <p className="text-xs text-slate-500">{t("visits.byHost", { name: visit.hostName })}</p>
              </div>
            </li>
          </ol>
        </Card>
      </div>

      <Sheet
        open={Boolean(share)}
        onClose={() => setShare(null)}
        title={
          share?.kind === "pass" ? t("visits.passLink") : t("visits.inviteLink")
        }
        description={
          share?.kind === "pass" ? t("visits.passHint") : t("visits.inviteHint")
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
                share.kind === "pass" ? t("visits.yourPass") : t("invite.shareTitle")
              }
              text={t("visits.helloVisitor", { name: visit.visitorName })}
              className="w-full"
            />
          )}
        </div>
      </Sheet>

      <Sheet
        open={confirmCancel}
        onClose={() => setConfirmCancel(false)}
        title={t("visits.cancelConfirm")}
        description={t("visits.cancelHint")}
      >
        <div className="flex gap-3">
          <Button
            variant="outline"
            size="lg"
            className="flex-1"
            onClick={() => setConfirmCancel(false)}
          >
            {t("visits.keep")}
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
                toast.success(t("visits.cancelledToast"));
                setConfirmCancel(false);
              } catch (reason) {
                toast.error(
                  reason instanceof Error
                    ? reason.message
                    : t("visits.cancelFail"),
                );
              } finally {
                setBusy("");
              }
            }}
          >
            {t("visits.cancelVisit")}
          </Button>
        </div>
      </Sheet>

      <Sheet
        open={documents.length > 0}
        onClose={() => {
          setDocuments([]);
          setDocumentFilter("all");
        }}
        title={
          documentFilter === "vehicle"
            ? t("visits.plates")
            : documentFilter === "attachment"
              ? t("visits.attachments")
              : documentFilter === "identification"
                ? t("visits.idTitle")
                : t("visits.docsTitle")
        }
        description={t("visits.signedHint")}
      >
        <div className="space-y-4">
          {documents
            .filter(
              (document) =>
                documentFilter === "all" || document.kind === documentFilter,
            )
            .map((document) => (
            <figure key={document.id}>
              <figcaption className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
                {document.label}
              </figcaption>
              {brokenDocs.includes(document.id) ? (
                <p className="rounded-2xl bg-red-50 p-3 text-sm text-red-700">
                  {t("visits.imageFail")}
                </p>
              ) : (
                <img
                  src={document.url}
                  alt={`${document.label} del visitante`}
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
