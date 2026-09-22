/* eslint-disable @next/next/no-img-element */
"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Building2,
  CalendarClock,
  Link2,
  Check,
  ChevronRight,
  Clock3,
  FileCheck2,
  Loader2,
  LockKeyhole,
  MapPin,
  Pencil,
  Plus,
  ScanFace,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { Brand } from "./brand";
import { AddToCalendar } from "./add-to-calendar";
import { visitCalendarEvent } from "@/lib/calendar";
import { Button, Callout, Field, cn, fieldClass } from "./ui";
import { LanguageSwitcher } from "./language-switcher";
import { useI18n } from "./i18n-provider";
import { documentTypeMessageKey } from "@/lib/i18n";
import {
  DocumentCapture,
  PhotoCapture,
  type DocumentSide,
} from "./visitor/document-capture";
import { PassCard } from "./visitor/pass-card";
import { SavePassButton } from "./visitor/save-pass";
import { WalletButtons } from "./visitor/wallet-buttons";
import { isLiveMode } from "@/lib/config";
import { documentTypes } from "@/lib/domain";
import { passValidityWindow } from "@/lib/pass-window";
import { randomToken } from "@/lib/security";
import { showcaseOrganization, showcaseSettings } from "@/lib/demo-data";
import {
  getShowcaseServerSnapshot,
  getShowcaseSnapshot,
  patchShowcaseVisit,
  subscribeShowcase,
} from "@/lib/showcase-store";
import {
  documentFlags,
  extrasShowsNotes,
  extrasShowsVehicle,
  firstRegistrationStep,
  parseVisitorFlow,
  registrationPath,
  resolvedVisitorName,
  stepAfter,
  stepBefore,
  validateRegistration,
  type RegistrationStep,
  type VisitorFlowConfig,
} from "@/lib/visitor-flow";

type Step = RegistrationStep;

type FormField =
  | "fullName"
  | "email"
  | "phone"
  | "company"
  | "documentType"
  | "documentNumber"
  | "vehiclePlate"
  | "visitorNotes";

type Invitation = {
  visitId: string;
  state: "active" | "completed" | "expired" | "cancelled" | "invalid";
  organizationName: string;
  locationName: string;
  locationAddress: string;
  internalPlace: string;
  meetingUrl: string;
  hostName: string;
  startsAt: string;
  endsAt: string;
  purpose: string;
  accessRequirements: string;
  privacyNotice: string;
  retentionDays: number;
  requireIdentification: boolean;
  visitorFlow: VisitorFlowConfig;
  visitorName: string;
  visitorEmail: string;
  visitorPhone: string;
  visitorCompany: string;
};

type CaptureTarget =
  | { kind: "id"; side: DocumentSide }
  | { kind: "vehicle" }
  | { kind: "attachment" };

type PhotoItem = { file: File; preview: string };

const invalidInvitation = {
  visitId: "",
  state: "invalid",
  visitorFlow: parseVisitorFlow(undefined, true),
} as Invitation;

export function VisitorFlow({
  token,
  sandbox = false,
}: {
  token: string;
  sandbox?: boolean;
}) {
  const live = isLiveMode() && !sandbox;
  const { t, formatFullDate } = useI18n();

  const showcaseState = useSyncExternalStore(
    subscribeShowcase,
    getShowcaseSnapshot,
    getShowcaseServerSnapshot,
  );
  const showcaseVisit = live
    ? undefined
    : showcaseState.visits.find((visit) => visit.invitationToken === token);

  const [remoteInvitation, setRemoteInvitation] = useState<Invitation | null>(
    null,
  );
  const [loading, setLoading] = useState(live);
  const [step, setStep] = useState<Step>("welcome");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const topRef = useRef<HTMLDivElement>(null);

  const [edits, setEdits] = useState<Partial<Record<FormField, string>>>({});
  const [files, setFiles] = useState<Partial<Record<DocumentSide, File>>>({});
  const [previews, setPreviews] = useState<
    Partial<Record<DocumentSide, string>>
  >({});
  const [vehiclePhotos, setVehiclePhotos] = useState<PhotoItem[]>([]);
  const [attachmentPhotos, setAttachmentPhotos] = useState<PhotoItem[]>([]);
  const [capturing, setCapturing] = useState<CaptureTarget | null>(null);
  const [consent, setConsent] = useState(false);
  const [passToken, setPassToken] = useState("");
  const [invitationUrl, setInvitationUrl] = useState("");
  const [wallet, setWallet] = useState<{ apple?: boolean; google?: boolean }>();

  const invitation: Invitation | null = useMemo(() => {
    if (live) return remoteInvitation;
    if (!showcaseVisit) return invalidInvitation;
    const visitorFlow = parseVisitorFlow(
      showcaseSettings.visitorFlow,
      showcaseSettings.requireIdentification,
    );
    return {
      visitId: showcaseVisit.id,
      state:
        showcaseVisit.status === "cancelled"
          ? "cancelled"
          : showcaseVisit.qrToken
            ? "completed"
            : "active",
      organizationName: showcaseOrganization.name,
      locationName: showcaseVisit.location,
      locationAddress: showcaseVisit.locationAddress ?? "",
      internalPlace: showcaseVisit.internalPlace ?? "",
      meetingUrl: showcaseVisit.meetingUrl ?? "",
      hostName: showcaseVisit.hostName,
      startsAt: showcaseVisit.startsAt,
      endsAt: showcaseVisit.endsAt,
      purpose: showcaseVisit.purpose,
      accessRequirements: showcaseVisit.accessRequirements ?? "",
      privacyNotice: showcaseSettings.privacyNotice,
      retentionDays: showcaseSettings.documentRetentionDays,
      requireIdentification: visitorFlow.identification === "required",
      visitorFlow,
      visitorName: showcaseVisit.inviteeName ?? "",
      visitorEmail: showcaseVisit.inviteeEmail ?? "",
      visitorPhone: showcaseVisit.inviteePhone ?? "",
      visitorCompany: showcaseVisit.inviteeCompany ?? "",
    };
  }, [live, remoteInvitation, showcaseVisit]);

  const flow = invitation?.visitorFlow ?? parseVisitorFlow(undefined, true);
  const hasIdentityPhotos = Boolean(files.front || files.back);
  const path = registrationPath(flow, hasIdentityPhotos);
  const totalSteps = Math.max(1, path.length);

  useEffect(() => {
    setInvitationUrl(`${window.location.origin}/visit/${token}`);
  }, [token]);

  useEffect(() => {
    if (!live) return;
    let active = true;

    void (async () => {
      try {
        const response = await fetch(
          `/api/public/invitations/${encodeURIComponent(token)}`,
          { cache: "no-store" },
        );
        if (!response.ok) throw new Error("invalid");
        const row = (await response.json()) as Record<string, unknown>;
        if (!active) return;
        const visitorFlow = parseVisitorFlow(
          row.visitor_flow,
          row.require_identification !== false,
        );
        setRemoteInvitation({
          visitId: String(row.visit_id ?? ""),
          state: (row.state as Invitation["state"]) ?? "invalid",
          organizationName: String(row.organization_name ?? ""),
          locationName: String(row.location_name ?? ""),
          locationAddress: String(row.location_address ?? ""),
          internalPlace: String(row.internal_place ?? ""),
          meetingUrl: String(row.meeting_url ?? ""),
          hostName: String(row.host_name ?? ""),
          startsAt: String(row.starts_at ?? ""),
          endsAt: String(row.ends_at ?? ""),
          purpose: String(row.purpose ?? ""),
          accessRequirements: String(row.access_requirements ?? ""),
          privacyNotice: String(row.privacy_notice ?? ""),
          retentionDays: Number(row.retention_days ?? 30),
          requireIdentification: visitorFlow.identification === "required",
          visitorFlow,
          visitorName: String(row.visitor_name ?? ""),
          visitorEmail: String(row.visitor_email ?? ""),
          visitorPhone: String(row.visitor_phone ?? ""),
          visitorCompany: String(row.visitor_company ?? ""),
        });
      } catch {
        if (active) setRemoteInvitation(invalidInvitation);
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [live, token]);

  const value = useCallback(
    (name: FormField): string => {
      const edited = edits[name];
      if (edited !== undefined) return edited;
      switch (name) {
        case "fullName":
          return invitation?.visitorName || "";
        case "email":
          return invitation?.visitorEmail || "";
        case "phone":
          return invitation?.visitorPhone || "";
        case "company":
          return invitation?.visitorCompany || "";
        case "documentType":
          return documentTypes[0];
        default:
          return "";
      }
    },
    [edits, invitation],
  );

  const set = useCallback((name: FormField, next: string) => {
    setEdits((current) => ({ ...current, [name]: next }));
  }, []);

  const go = useCallback((next: Step) => {
    setError("");
    setCapturing(null);
    setStep(next);
    topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const stepIndex = path.indexOf(step) + 1;

  function advance(from: Step) {
    const next = stepAfter(from, flow, hasIdentityPhotos);
    if (next === "done") {
      void submit();
      return;
    }
    go(next);
  }

  function back(from: Step) {
    go(stepBefore(from, flow, hasIdentityPhotos));
  }

  async function submit() {
    const fullName = resolvedVisitorName(
      value("fullName"),
      invitation?.visitorName,
      flow.identity,
    );
    const problem = validateRegistration(
      {
        fullName: value("fullName"),
        email: value("email"),
        phone: value("phone"),
        company: value("company"),
        vehiclePlate: value("vehiclePlate"),
        visitorNotes: value("visitorNotes"),
        consent,
        identityPhotos: Number(Boolean(files.front)) + Number(Boolean(files.back)),
        vehiclePhotos: vehiclePhotos.length,
        attachmentPhotos: attachmentPhotos.length,
        invitedName: invitation?.visitorName,
      },
      flow,
    );
    if (problem) {
      setError(t(`errors.${problem}`));
      if (problem.startsWith("identity_")) go("document");
      else if (problem.startsWith("plate_"))
        go(flow.vehicle === "required" ? "vehicle" : "extras");
      else if (problem === "attachment_required") go("attachments");
      else if (problem === "notes_required") go("extras");
      else if (problem === "consent_required") go("consent");
      else if (flow.identity !== "off") go("identity");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const flags = documentFlags([
        files.front ? "identity_front" : null,
        files.back ? "identity_back" : null,
        ...vehiclePhotos.map(() => "vehicle_plate"),
        ...attachmentPhotos.map(() => "attachment"),
      ]);
      if (live) {
        const form = new FormData();
        const fields: Array<[string, string]> = [
          ["fullName", fullName],
          ["email", value("email")],
          ["phone", value("phone")],
          ["company", value("company")],
          [
            "documentType",
            value("documentType") ||
              (files.front || files.back ? "INE" : "No presentada"),
          ],
          ["documentNumber", value("documentNumber")],
          ["vehiclePlate", value("vehiclePlate")],
          ["visitorNotes", value("visitorNotes")],
        ];
        fields.forEach(([key, fieldValue]) => {
          if (fieldValue) form.set(key, fieldValue);
        });
        form.set("consent", consent ? "true" : "false");
        if (files.front) form.set("documentFront", files.front);
        if (files.back) form.set("documentBack", files.back);
        vehiclePhotos.forEach((photo) =>
          form.append("vehiclePlatePhoto", photo.file),
        );
        attachmentPhotos.forEach((photo) =>
          form.append("attachment", photo.file),
        );

        const response = await fetch(
          `/api/public/invitations/${encodeURIComponent(token)}/register`,
          { method: "POST", body: form },
        );
        const payload = (await response.json()) as {
          qrToken?: string;
          wallet?: { apple?: boolean; google?: boolean };
          error?: string;
        };
        if (!response.ok || !payload.qrToken)
          throw new Error(
            payload.error ?? t("errors.register_failed"),
          );

        setPassToken(payload.qrToken);
        setWallet(payload.wallet);
        window.history.replaceState(null, "", `/pass/${payload.qrToken}`);
      } else {
        const generated = randomToken(24);
        const documentNumber = value("documentNumber");
        patchShowcaseVisit(
          invitation!.visitId,
          {
            visitorName: fullName,
            email: value("email"),
            phone: value("phone"),
            company: value("company"),
            documentType: value("documentType"),
            documentMasked: documentNumber
              ? `•••• ${documentNumber.slice(-4)}`
              : undefined,
            vehiclePlate: value("vehiclePlate") || undefined,
            visitorNotes: value("visitorNotes") || undefined,
            status: "pre_registered",
            ...flags,
            consentedAt: consent ? new Date().toISOString() : undefined,
            qrToken: generated,
          },
          { type: "pre_registered", actor: fullName },
        );
        setPassToken(generated);
      }
      go("done");
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : t("errors.register_failed"),
      );
    } finally {
      setSubmitting(false);
    }
  }

  const progressValue =
    step === "welcome" || step === "done"
      ? step === "done"
        ? 100
        : 0
      : (Math.max(1, stepIndex) / totalSteps) * 100;

  const dateLabel = useMemo(
    () => (invitation?.startsAt ? formatFullDate(invitation.startsAt) : ""),
    [invitation, formatFullDate],
  );

  const extrasTitle =
    extrasShowsVehicle(flow) && extrasShowsNotes(flow)
      ? t("visitor.extras")
      : extrasShowsVehicle(flow)
        ? t("visitor.yourVehicle")
        : t("visitor.receptionNotes");

  if (loading)
    return (
      <Frame>
        <div className="py-20 text-center">
          <Loader2 className="mx-auto animate-spin text-[#10aaa5]" size={38} />
          <p className="mt-4 text-sm text-slate-500">{t("visitor.validating")}</p>
        </div>
      </Frame>
    );

  if (!invitation || invitation.state === "invalid")
    return (
      <Frame>
        <StateCard
          tone="warning"
          icon={AlertTriangle}
          title={t("visitor.invalidTitle")}
          text={t("visitor.invalidText")}
        />
      </Frame>
    );

  if (invitation.state === "cancelled")
    return (
      <Frame>
        <StateCard
          tone="warning"
          icon={AlertTriangle}
          title={t("visitor.cancelledTitle")}
          text={t("visitor.cancelledText", { name: invitation.hostName })}
        />
      </Frame>
    );

  if (invitation.state === "expired")
    return (
      <Frame>
        <StateCard
          tone="warning"
          icon={Clock3}
          title={t("visitor.expiredTitle")}
          text={t("visitor.expiredText")}
        />
      </Frame>
    );

  if (invitation.state === "completed" && step !== "done")
    return (
      <Frame>
        <StateCard
          tone="success"
          icon={BadgeCheck}
          title={t("visitor.doneAlreadyTitle")}
          text={t("visitor.doneAlreadyText")}
        />
      </Frame>
    );

  const captureCopy =
    capturing?.kind === "vehicle"
      ? {
          title: t("visitor.platePhotoTitle"),
          hint: t("visitor.platePhotoHint"),
          footer: t("visitor.platePhotoFooter"),
          guide: "wide" as const,
          prefix: "placa",
        }
      : capturing?.kind === "attachment"
        ? {
            title: t("visitor.attachmentTitle"),
            hint: t("visitor.attachmentHint"),
            footer: t("visitor.attachmentFooter"),
            guide: "square" as const,
            prefix: "anexo",
          }
        : null;

  return (
    <Frame progress={progressValue}>
      <div ref={topRef} className="scroll-mt-24" />

      {step === "welcome" && (
        <div className="animate-rise text-center">
          <span className="mx-auto grid size-[72px] place-items-center rounded-[26px] bg-[#10cfc9]/15 text-[#0d9d99]">
            <Sparkles size={32} />
          </span>
          <p className="mt-6 text-[13px] font-semibold uppercase tracking-[.18em] text-[#0d9d99]">
            {invitation.organizationName}
          </p>
          <h1 className="mt-3 text-[30px] font-semibold leading-[1.15] tracking-[-.035em]">
            {t("visitor.waiting", { name: invitation.hostName })}
          </h1>
          <p className="mx-auto mt-3 max-w-sm text-[15px] leading-6 text-slate-500">
            {value("fullName")
              ? t("visitor.hello", { name: value("fullName").split(" ")[0] })
              : ""}
            {t("visitor.intro")}
          </p>

          <div className="mt-7 space-y-3 text-left">
            <SummaryRow icon={CalendarClock} label={t("visitor.when")} value={dateLabel} />
            <SummaryRow
              icon={MapPin}
              label={t("visitor.where")}
              value={invitation.locationName}
              hint={invitation.locationAddress}
            />
            {invitation.internalPlace && (
              <SummaryRow
                icon={Building2}
                label={t("visitor.internalPlace")}
                value={invitation.internalPlace}
              />
            )}
            {invitation.meetingUrl && (
              <SummaryRow
                icon={Link2}
                label={t("visitor.meetingLink")}
                value={t("visitor.openMeeting")}
                href={invitation.meetingUrl}
              />
            )}
            <SummaryRow icon={FileCheck2} label={t("visitor.purpose")} value={invitation.purpose} />
            {invitation.accessRequirements && (
              <SummaryRow
                icon={ShieldCheck}
                label={t("visitor.requirements")}
                value={invitation.accessRequirements}
              />
            )}
          </div>

          {invitation && (
            <div className="mt-6 text-left">
              <AddToCalendar
                event={visitCalendarEvent({
                  id: invitation.visitId,
                  title: `${invitation.hostName} te espera en ${invitation.organizationName}`,
                  startsAt: invitation.startsAt,
                  endsAt: invitation.endsAt,
                  organizationName: invitation.organizationName,
                  locationName: invitation.locationName,
                  locationAddress: invitation.locationAddress,
                  internalPlace: invitation.internalPlace,
                  meetingUrl: invitation.meetingUrl,
                  purpose: invitation.purpose,
                  invitationUrl,
                  organizerName: invitation.hostName,
                })}
              />
            </div>
          )}

          <div className="mt-7 space-y-4">
            <Button
              variant="accent"
              size="lg"
              block
              onClick={() => {
                const first = firstRegistrationStep(flow);
                if (first === "done") void submit();
                else go(first);
              }}
              className="min-h-[52px] text-base"
            >
              {t("visitor.start")}
              <ArrowRight size={19} />
            </Button>
            <p className="flex items-center justify-center gap-1.5 pb-2 text-xs text-slate-400">
              <LockKeyhole size={13} />
              {t("visitor.personalLink")}
            </p>
          </div>
        </div>
      )}

      {step === "identity" && (
        <StepShell
          index={stepIndex}
          total={totalSteps}
          title={t("visitor.yourData")}
          subtitle={
            invitation.visitorName || invitation.visitorEmail
              ? t("visitor.dataPrefill")
              : t("visitor.dataHint")
          }
          onBack={() => back("identity")}
          onNext={() => {
            const problem = validateRegistration(
              {
                fullName: value("fullName"),
                email: value("email"),
                phone: value("phone"),
                company: value("company"),
                vehiclePlate: value("vehiclePlate"),
                visitorNotes: value("visitorNotes"),
                consent: true,
                identityPhotos: 2,
                vehiclePhotos: 1,
                attachmentPhotos: 1,
              },
              { ...flow, identification: "off", vehicle: "off", notes: "off", attachments: "off", consent: "off" },
            );
            if (problem) return setError(t(`errors.${problem}`));
            advance("identity");
          }}
          error={error}
        >
          <div className="space-y-4">
            <Field
              label={t("visitor.fullName")}
              optional={flow.identity !== "required"}
            >
              <input
                className={fieldClass}
                autoComplete="name"
                placeholder={t("visitor.namePlaceholder")}
                value={value("fullName")}
                onChange={(event) => set("fullName", event.target.value)}
              />
            </Field>
            <Field
              label={t("visitor.email")}
              optional={flow.identity !== "required"}
              hint={t("visitor.emailHint")}
            >
              <input
                className={fieldClass}
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="tu@empresa.com"
                value={value("email")}
                onChange={(event) => set("email", event.target.value)}
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t("visitor.phone")} optional={flow.identity !== "required"}>
                <input
                  className={fieldClass}
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="55 1234 5678"
                  value={value("phone")}
                  onChange={(event) => set("phone", event.target.value)}
                />
              </Field>
              <Field label={t("visitor.company")} optional={flow.identity !== "required"}>
                <input
                  className={fieldClass}
                  autoComplete="organization"
                  placeholder={t("visitor.companyPlaceholder")}
                  value={value("company")}
                  onChange={(event) => set("company", event.target.value)}
                />
              </Field>
            </div>
          </div>
        </StepShell>
      )}

      {step === "document" &&
        (capturing?.kind === "id" ? (
          <div className="animate-rise">
            <p className="text-[13px] font-semibold text-[#0d9d99]">
              {t("visitor.stepOf", { index: stepIndex, total: totalSteps })}
            </p>
            <h1 className="mt-2 text-[26px] font-semibold leading-tight tracking-[-.03em]">
              {t("visitor.identification")}
            </h1>
            <p className="mb-6 mt-2 text-[15px] leading-6 text-slate-500">
              {t("visitor.idFrame")}
            </p>

            <DocumentCapture
              side={capturing.side}
              onCancel={() => setCapturing(null)}
              onCaptured={(captured, url) => {
                setFiles((current) => ({ ...current, [capturing.side]: captured }));
                setPreviews((current) => ({ ...current, [capturing.side]: url }));
                setCapturing(null);
              }}
            />
          </div>
        ) : (
          <StepShell
            index={stepIndex}
            total={totalSteps}
            title={t("visitor.identification")}
            subtitle={
              flow.identification === "required"
                ? t("visitor.idRequired")
                : t("visitor.idOptional")
            }
            onBack={() => back("document")}
            onNext={() => {
              if (flow.identification === "required" && !files.front)
                return setError(t("errors.identity_front_required"));
              if (flow.identification === "required" && !files.back)
                return setError(t("errors.identity_back_required"));
              advance("document");
            }}
            nextLabel={
              flow.identification === "required" && (!files.front || !files.back)
                ? t("visitor.addPhotos")
                : t("common.continue")
            }
            nextDisabled={
              flow.identification === "required" && (!files.front || !files.back)
            }
            error={error}
          >
            <div className="mb-5">
              <Field label={t("visitor.idType")}>
                <select
                  className={fieldClass}
                  value={value("documentType")}
                  onChange={(event) => set("documentType", event.target.value)}
                >
                  {documentTypes.map((type) => (
                    <option key={type} value={type}>
                      {documentTypeMessageKey(type)
                        ? t(documentTypeMessageKey(type))
                        : type}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {(["front", "back"] as DocumentSide[]).map((side) => (
                <SideSlot
                  key={side}
                  side={side}
                  preview={previews[side]}
                  onPick={() => {
                    setError("");
                    setCapturing({ kind: "id", side });
                  }}
                />
              ))}
            </div>

            <Callout tone="info" icon={ShieldCheck} className="mt-5">
              {flow.identification === "required"
                ? t("visitor.idRequiredNote")
                : t("visitor.idOptionalNote")}
            </Callout>
          </StepShell>
        ))}

      {step === "review" && (
        <StepShell
          index={stepIndex}
          total={totalSteps}
          title={t("visitor.review")}
          subtitle={t("visitor.reviewHint")}
          onBack={() => back("review")}
          onNext={() => {
            if (flow.identity === "required" && !value("fullName").trim())
              return setError(t("errors.name_required"));
            advance("review");
          }}
          error={error}
        >
          <div className="mb-5 flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
            {previews.front ? (
              <img
                src={previews.front}
                alt=""
                className="size-16 shrink-0 overflow-hidden rounded-xl bg-white object-cover text-[0px]"
              />
            ) : (
              <span className="grid size-16 place-items-center rounded-xl bg-white text-slate-400">
                <FileCheck2 size={22} />
              </span>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">{t("visitor.idCaptured")}</p>
              <p className="mt-0.5 text-xs text-slate-500">
                {t("visitor.sidesReady")}
              </p>
            </div>
            <button
              type="button"
              onClick={() => go("document")}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold active:bg-slate-50"
            >
              <Pencil size={14} />
              {t("visitor.repeat")}
            </button>
          </div>

          <div className="space-y-4">
            <Field label={t("visitor.fullName")}>
              <input
                className={fieldClass}
                value={value("fullName")}
                onChange={(event) => set("fullName", event.target.value)}
              />
            </Field>
            <Field
              label={t("visitor.folio")}
              optional
              hint={t("visitor.folioHint")}
            >
              <input
                className={fieldClass}
                value={value("documentNumber")}
                onChange={(event) => set("documentNumber", event.target.value)}
              />
            </Field>
          </div>
        </StepShell>
      )}

      {step === "vehicle" &&
        (capturing?.kind === "vehicle" && captureCopy ? (
          <CaptureScreen
            index={stepIndex}
            total={totalSteps}
            heading={t("visitor.yourVehicle")}
            copy={captureCopy}
            onCancel={() => setCapturing(null)}
            onCaptured={(file, preview) => {
              setVehiclePhotos((current) => [...current, { file, preview }]);
              setCapturing(null);
            }}
          />
        ) : (
          <StepShell
            index={stepIndex}
            total={totalSteps}
            title={t("visitor.yourVehicle")}
            subtitle={t("visitor.vehicleHint")}
            onBack={() => back("vehicle")}
            onNext={() => {
              if (!value("vehiclePlate").trim())
                return setError(t("errors.plate_required"));
              if (vehiclePhotos.length < 1)
                return setError(t("errors.plate_photo_required"));
              advance("vehicle");
            }}
            nextDisabled={
              !value("vehiclePlate").trim() || vehiclePhotos.length < 1
            }
            error={error}
          >
            <VehicleFields
              plate={value("vehiclePlate")}
              onPlate={(next) => set("vehiclePlate", next.toUpperCase())}
              photos={vehiclePhotos}
              required
              onAdd={() => {
                setError("");
                setCapturing({ kind: "vehicle" });
              }}
              onRemove={(index) =>
                setVehiclePhotos((current) =>
                  current.filter((_, item) => item !== index),
                )
              }
            />
          </StepShell>
        ))}

      {step === "extras" &&
        (capturing?.kind === "vehicle" && captureCopy ? (
          <CaptureScreen
            index={stepIndex}
            total={totalSteps}
            heading={extrasTitle}
            copy={captureCopy}
            onCancel={() => setCapturing(null)}
            onCaptured={(file, preview) => {
              setVehiclePhotos((current) => [...current, { file, preview }]);
              setCapturing(null);
            }}
          />
        ) : (
          <StepShell
            index={stepIndex}
            total={totalSteps}
            title={extrasTitle}
            subtitle={
              flow.notes === "required" || flow.vehicle === "required"
                ? t("visitor.extrasRequired")
                : t("visitor.extrasHint")
            }
            onBack={() => back("extras")}
            onNext={() => {
              if (flow.notes === "required" && !value("visitorNotes").trim())
                return setError(t("errors.notes_required"));
              advance("extras");
            }}
            error={error}
          >
            <div className="space-y-4">
              {extrasShowsVehicle(flow) && (
                <VehicleFields
                  plate={value("vehiclePlate")}
                  onPlate={(next) => set("vehiclePlate", next.toUpperCase())}
                  photos={vehiclePhotos}
                  required={false}
                  onAdd={() => {
                    setError("");
                    setCapturing({ kind: "vehicle" });
                  }}
                  onRemove={(index) =>
                    setVehiclePhotos((current) =>
                      current.filter((_, item) => item !== index),
                    )
                  }
                />
              )}
              {extrasShowsNotes(flow) && (
                <Field
                  label={t("visitor.receptionNotes")}
                  optional={flow.notes !== "required"}
                >
                  <textarea
                    rows={3}
                    className="w-full rounded-2xl border border-slate-200 bg-white p-4 text-[16px] outline-none focus:border-[#10aaa5] focus:ring-4 focus:ring-[#10cfc9]/15"
                    placeholder={t("visitor.notesPlaceholder")}
                    value={value("visitorNotes")}
                    onChange={(event) => set("visitorNotes", event.target.value)}
                  />
                </Field>
              )}
            </div>

            <div className="mt-6 rounded-2xl bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-400">
                {t("visitor.yourVisit")}
              </p>
              <p className="mt-1.5 font-semibold">{invitation.hostName}</p>
              <p className="mt-1 text-sm text-slate-500">{dateLabel}</p>
              <p className="text-sm text-slate-500">{invitation.locationName}</p>
            </div>
          </StepShell>
        ))}

      {step === "attachments" &&
        (capturing?.kind === "attachment" && captureCopy ? (
          <CaptureScreen
            index={stepIndex}
            total={totalSteps}
            heading={t("visitor.attachments")}
            copy={captureCopy}
            onCancel={() => setCapturing(null)}
            onCaptured={(file, preview) => {
              setAttachmentPhotos((current) => [...current, { file, preview }]);
              setCapturing(null);
            }}
          />
        ) : (
          <StepShell
            index={stepIndex}
            total={totalSteps}
            title={t("visitor.attachments")}
            subtitle={
              flow.attachments === "required"
                ? t("visitor.attachmentsRequired")
                : t("visitor.attachmentsOptional")
            }
            onBack={() => back("attachments")}
            onNext={() => {
              if (flow.attachments === "required" && attachmentPhotos.length < 1)
                return setError(t("errors.attachment_required"));
              advance("attachments");
            }}
            nextDisabled={
              flow.attachments === "required" && attachmentPhotos.length < 1
            }
            error={error}
          >
            <PhotoList
              photos={attachmentPhotos}
              addLabel={t("visitor.addPhoto")}
              emptyHint={t("visitor.attachmentEmpty")}
              onAdd={() => {
                setError("");
                setCapturing({ kind: "attachment" });
              }}
              onRemove={(index) =>
                setAttachmentPhotos((current) =>
                  current.filter((_, item) => item !== index),
                )
              }
            />
          </StepShell>
        ))}

      {step === "consent" && (
        <StepShell
          index={stepIndex}
          total={totalSteps}
          title={t("visitor.privacy")}
          subtitle={t("visitor.privacyHint")}
          onBack={() => back("consent")}
          onNext={submit}
          nextLabel={submitting ? t("visitor.generating") : t("visitor.acceptPass")}
          nextDisabled={(flow.consent === "required" && !consent) || submitting}
          busy={submitting}
          error={error}
        >
          <div className="max-h-64 overflow-y-auto rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm leading-6 text-slate-600">
            <p className="font-semibold text-[#071426]">
              {t("visitor.noticeTitle", { org: invitation.organizationName })}
            </p>
            <p className="mt-2 whitespace-pre-line">
              {invitation.privacyNotice || t("visitor.noticeFallback")}
            </p>
            {flow.identification !== "off" ? (
              <p className="mt-3">
                {t("visitor.retention", { days: invitation.retentionDays })}
              </p>
            ) : (
              <p className="mt-3">{t("visitor.noIdNotice")}</p>
            )}
          </div>

          <button
            type="button"
            onClick={() => setConsent(!consent)}
            className={cn(
              "mt-4 flex w-full items-start gap-3 rounded-2xl border p-4 text-left transition",
              consent
                ? "border-[#10cfc9] bg-[#10cfc9]/10"
                : "border-slate-200 bg-white",
            )}
          >
            <span
              className={cn(
                "mt-0.5 grid size-6 shrink-0 place-items-center rounded-lg border-2 transition",
                consent
                  ? "border-[#0d9d99] bg-[#10cfc9] text-white"
                  : "border-slate-300",
              )}
            >
              {consent && <Check size={15} strokeWidth={3} />}
            </span>
            <span className="text-sm leading-6 text-[#071426]">
              {t("visitor.consent")}
            </span>
          </button>
        </StepShell>
      )}

      {step === "done" && (
        <div className="animate-rise text-center">
          <span className="animate-pop mx-auto grid size-16 place-items-center rounded-full bg-emerald-50 text-emerald-600">
            <Check size={32} strokeWidth={3} />
          </span>
          <h1 className="mt-5 text-[26px] font-semibold tracking-[-.03em]">
            {t("visitor.allSet")}
          </h1>
          <p className="mt-2 text-[15px] text-slate-500">
            {t("visitor.saveNow")}
          </p>

          <div className="mt-7">
            <PassCard
              token={passToken}
              visitorName={resolvedVisitorName(
                value("fullName"),
                invitation.visitorName,
                flow.identity,
              )}
              organizationName={invitation.organizationName}
              hostName={invitation.hostName}
              location={invitation.locationName}
              startsAt={invitation.startsAt}
              expiresAt={
                passValidityWindow({
                  startsAt: invitation.startsAt,
                  endsAt: invitation.endsAt,
                }).expires_at
              }
              accessRequirements={invitation.accessRequirements || undefined}
              internalPlace={invitation.internalPlace || undefined}
              meetingUrl={invitation.meetingUrl || undefined}
              publicQr={!live}
            />
          </div>

          <div className="mt-6 space-y-4">
            <SavePassButton
              token={passToken}
              visitorName={resolvedVisitorName(
                value("fullName"),
                invitation.visitorName,
                flow.identity,
              )}
              organizationName={invitation.organizationName}
              hostName={invitation.hostName}
              location={invitation.locationName}
              startsAt={invitation.startsAt}
              promptOnMount
              publicQr={!live}
            />
            <WalletButtons token={passToken} available={wallet} />

            <Link
              href={`/pass/${passToken}`}
              className="inline-flex h-13 w-full items-center justify-center gap-2 rounded-2xl bg-[#071426] text-[15px] font-semibold text-white"
            >
              {t("visitor.openPass")}
              <ChevronRight size={18} />
            </Link>
            {(value("email") || invitation.visitorEmail) && (
              <p className="mx-auto max-w-xs text-xs leading-5 text-slate-400">
                {t("visitor.emailAlso")}
              </p>
            )}
          </div>
        </div>
      )}
    </Frame>
  );
}

function Frame({
  children,
  progress,
}: {
  children: React.ReactNode;
  progress?: number;
}) {
  const { t } = useI18n();
  return (
    <main className="flex min-h-[100dvh] flex-col bg-[#f4f7fb]">
      <header className="safe-top sticky top-0 z-20 shrink-0 border-b border-slate-200 bg-white/90 backdrop-blur-lg">
        <div className="mx-auto flex h-14 max-w-2xl items-center justify-between px-5">
          <Brand href="#" />
          <span className="flex items-center gap-2">
            <LanguageSwitcher compact />
            <span className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500">
              <LockKeyhole size={13} />
              {t("common.secure")}
            </span>
          </span>
        </div>
        {progress !== undefined && (
          <div className="h-1 bg-slate-100">
            <div
              className="h-full bg-[#10cfc9] transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}
      </header>

      <div className="safe-bottom mx-auto w-full max-w-2xl flex-1 px-4 pb-8 pt-6 sm:px-6 sm:pb-12 sm:pt-10">
        <div className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-[0_1px_2px_rgba(7,20,38,.04),0_18px_48px_-30px_rgba(7,20,38,.4)] sm:p-8">
          {children}
        </div>
      </div>
    </main>
  );
}

function StepShell({
  index,
  total,
  title,
  subtitle,
  children,
  onBack,
  onNext,
  nextLabel,
  nextDisabled,
  hideNext,
  busy,
  error,
}: {
  index: number;
  total: number;
  title: string;
  subtitle: string;
  children: React.ReactNode;
  onBack: () => void;
  onNext?: () => void;
  nextLabel?: string;
  nextDisabled?: boolean;
  hideNext?: boolean;
  busy?: boolean;
  error?: string;
}) {
  const { t } = useI18n();
  return (
    <div className="animate-rise">
      <p className="text-[13px] font-semibold text-[#0d9d99]">
        {t("visitor.stepOf", { index: Math.max(1, index), total })}
      </p>
      <h1 className="mt-2 text-[26px] font-semibold leading-tight tracking-[-.03em]">
        {title}
      </h1>
      <p className="mb-6 mt-2 text-[15px] leading-6 text-slate-500">{subtitle}</p>

      {children}

      {error && (
        <div
          role="alert"
          className="mt-5 flex items-start gap-2 rounded-2xl bg-red-50 p-4 text-sm leading-6 text-red-700"
        >
          <AlertTriangle size={17} className="mt-0.5 shrink-0" />
          {error}
        </div>
      )}

      <div className="mt-7 flex items-center gap-3 pb-2">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex h-13 min-h-[48px] items-center gap-1.5 rounded-2xl px-4 text-sm font-medium text-slate-500 active:bg-slate-100"
        >
          <ArrowLeft size={18} />
          {t("common.back")}
        </button>
        {!hideNext && onNext && (
          <Button
            variant="accent"
            size="lg"
            onClick={onNext}
            disabled={nextDisabled}
            className="min-h-[48px] flex-1"
          >
            {busy && <Loader2 size={18} className="animate-spin" />}
            {nextLabel ?? t("common.continue")}
            {!busy && <ArrowRight size={18} />}
          </Button>
        )}
      </div>
    </div>
  );
}

function CaptureScreen({
  index,
  total,
  heading,
  copy,
  onCancel,
  onCaptured,
}: {
  index: number;
  total: number;
  heading: string;
  copy: {
    title: string;
    hint: string;
    footer: string;
    guide: "wide" | "square";
    prefix: string;
  };
  onCancel: () => void;
  onCaptured: (file: File, preview: string) => void;
}) {
  const { t } = useI18n();
  return (
    <div className="animate-rise">
      <p className="text-[13px] font-semibold text-[#0d9d99]">
        {t("visitor.stepOf", { index, total })}
      </p>
      <h1 className="mt-2 text-[26px] font-semibold leading-tight tracking-[-.03em]">
        {heading}
      </h1>
      <p className="mb-6 mt-2 text-[15px] leading-6 text-slate-500">
        {t("visitor.capturePhoto")}
      </p>
      <PhotoCapture
        title={copy.title}
        hint={copy.hint}
        footer={copy.footer}
        guide={copy.guide}
        filePrefix={copy.prefix}
        onCancel={onCancel}
        onCaptured={onCaptured}
      />
    </div>
  );
}

function VehicleFields({
  plate,
  onPlate,
  photos,
  required,
  onAdd,
  onRemove,
}: {
  plate: string;
  onPlate: (value: string) => void;
  photos: PhotoItem[];
  required: boolean;
  onAdd: () => void;
  onRemove: (index: number) => void;
}) {
  const { t } = useI18n();
  return (
    <div className="space-y-4">
      <Field label={t("visitor.plate")} optional={!required}>
        <input
          className={fieldClass}
          placeholder={t("visitor.platePlaceholder")}
          value={plate}
          onChange={(event) => onPlate(event.target.value)}
        />
      </Field>
      <PhotoList
        photos={photos}
        addLabel={t("visitor.photoPlate")}
        emptyHint={t("visitor.plateEmptyHint")}
        onAdd={onAdd}
        onRemove={onRemove}
      />
    </div>
  );
}

function PhotoList({
  photos,
  addLabel,
  emptyHint,
  onAdd,
  onRemove,
}: {
  photos: PhotoItem[];
  addLabel: string;
  emptyHint: string;
  onAdd: () => void;
  onRemove: (index: number) => void;
}) {
  const { t } = useI18n();
  return (
    <div className="space-y-3">
      {photos.map((photo, index) => (
        <div
          key={`${photo.preview}-${index}`}
          className="flex items-center gap-3 rounded-2xl border border-[#10cfc9] bg-[#10cfc9]/[.07] p-3"
        >
          <img
            src={photo.preview}
            alt=""
            className="size-16 shrink-0 overflow-hidden rounded-xl bg-white object-cover text-[0px]"
          />
          <span className="min-w-0 flex-1 text-sm font-semibold">
            {t("visitor.photoN", { n: index + 1 })}
            <span className="mt-0.5 block text-xs font-normal text-slate-500">
              {t("visitor.readyBooth")}
            </span>
          </span>
          <button
            type="button"
            onClick={() => onRemove(index)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold"
          >
            {t("visitor.remove")}
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={onAdd}
        className="flex w-full items-center gap-3 rounded-2xl border-2 border-dashed border-slate-200 bg-white p-3 text-left transition active:scale-[.99]"
      >
        <span className="grid size-16 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-400">
          <Plus size={24} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="font-semibold">{addLabel}</span>
          <span className="mt-0.5 block text-xs text-slate-500">{emptyHint}</span>
        </span>
      </button>
    </div>
  );
}

function SideSlot({
  side,
  preview,
  onPick,
}: {
  side: DocumentSide;
  preview?: string;
  onPick: () => void;
}) {
  const { t } = useI18n();
  const label = t(side === "front" ? "visitor.front" : "visitor.back");
  const hint = t(side === "front" ? "visitor.withPhoto" : "visitor.otherSide");

  return (
    <button
      type="button"
      onClick={onPick}
      className={cn(
        "flex w-full items-center gap-3 rounded-2xl border-2 p-3 text-left transition active:scale-[.99]",
        preview
          ? "border-[#10cfc9] bg-[#10cfc9]/[.07]"
          : "border-dashed border-slate-200 bg-white",
      )}
    >
      {preview ? (
        <img
          src={preview}
          alt=""
          className="size-16 shrink-0 overflow-hidden rounded-xl bg-white object-cover text-[0px]"
        />
      ) : (
        <span className="grid size-16 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-400">
          <ScanFace size={24} />
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5 font-semibold">
          {label}
          {preview && <Check size={15} className="text-[#0d9d99]" />}
        </span>
        <span className="mt-0.5 block text-xs text-slate-500">
          {preview ? t("visitor.tapRepeat") : hint}
        </span>
      </span>
    </button>
  );
}

function SummaryRow({
  icon: Icon,
  label,
  value,
  hint,
  href,
}: {
  icon: typeof MapPin;
  label: string;
  value: string;
  hint?: string;
  href?: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-2xl bg-slate-50 p-4">
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white text-slate-500 shadow-sm">
        <Icon size={18} />
      </span>
      <div className="min-w-0">
        <p className="text-[11px] uppercase tracking-wide text-slate-400">
          {label}
        </p>
        {href ? (
          <a
            href={href}
            target="_blank"
            rel="noreferrer"
            className="mt-0.5 block break-all text-sm font-semibold leading-5 text-[#0d9d99] underline"
          >
            {value}
          </a>
        ) : (
          <p className="mt-0.5 text-sm font-semibold leading-5">{value}</p>
        )}
        {hint && <p className="mt-0.5 text-xs text-slate-500">{hint}</p>}
      </div>
    </div>
  );
}

function StateCard({
  icon: Icon,
  title,
  text,
  tone,
}: {
  icon: typeof AlertTriangle;
  title: string;
  text: string;
  tone: "warning" | "success";
}) {
  const { t } = useI18n();
  return (
    <div className="py-8 text-center">
      <span
        className={cn(
          "mx-auto grid size-16 place-items-center rounded-full",
          tone === "success"
            ? "bg-emerald-50 text-emerald-600"
            : "bg-amber-50 text-amber-600",
        )}
      >
        <Icon size={30} />
      </span>
      <h1 className="mt-5 text-2xl font-semibold tracking-[-.02em]">{title}</h1>
      <p className="mx-auto mt-2.5 max-w-sm text-[15px] leading-6 text-slate-500">
        {text}
      </p>
      <Link
        href="/"
        className="mt-7 inline-flex h-12 items-center gap-2 rounded-2xl border border-slate-200 px-5 text-sm font-semibold"
      >
        <Building2 size={17} />
        {t("visitor.learnMore")}
      </Link>
    </div>
  );
}
