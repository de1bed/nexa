"use client";

import {
  Building2,
  CalendarClock,
  Camera,
  FileCheck2,
  Link2,
  MapPin,
  ShieldCheck,
} from "lucide-react";
import { useI18n } from "./i18n-provider";
import { cn } from "./ui";
import {
  extrasShowsNotes,
  extrasShowsVehicle,
  registrationSteps,
  type RegistrationStep,
  type StepPolicy,
  type VisitorFlowConfig,
} from "@/lib/visitor-flow";

/**
 * Réplica de lo que abre el visitante: la portada de la invitación y cada
 * campo que la empresa decidió pedir. En configuración es la plantilla; al
 * crear una visita usa los datos que se están escribiendo.
 */
export function InvitationPreview({
  variant,
  flow,
  organizationName,
  hostName,
  locationName,
  locationAddress,
  whenLabel,
  purpose,
  accessRequirements,
  internalPlace,
  meetingUrl,
  visitorName,
  email,
  phone,
  company,
  privacyNotice,
  retentionDays,
}: {
  variant: "template" | "invitation";
  flow: VisitorFlowConfig;
  organizationName: string;
  hostName?: string;
  locationName?: string;
  locationAddress?: string;
  whenLabel?: string;
  purpose?: string;
  accessRequirements?: string;
  internalPlace?: string;
  meetingUrl?: string;
  visitorName?: string;
  email?: string;
  phone?: string;
  company?: string;
  privacyNotice?: string;
  retentionDays?: number;
}) {
  const { t } = useI18n();
  const steps = registrationSteps(flow);
  const sample = variant === "template";
  const host = hostName?.trim() || (sample ? t("preview.sampleHost") : "");
  const place = locationName?.trim() || (sample ? t("preview.sampleLocation") : "");
  const when = whenLabel?.trim() || (sample ? t("preview.sampleWhen") : "");
  const reason = purpose?.trim() || (sample ? t("preview.samplePurpose") : "");

  return (
    <aside className="overflow-hidden rounded-[28px] border border-slate-200 bg-[#f4f8fb] shadow-[0_18px_40px_-28px_rgba(7,20,38,.45)]">
      <div className="border-b border-slate-200 bg-white px-4 py-3">
        <p className="text-[11px] font-semibold uppercase tracking-[.16em] text-[#0d9d99]">
          {t("preview.visitorView")}
        </p>
        <p className="mt-1 text-xs leading-5 text-slate-500">
          {sample ? t("preview.templateHint") : t("preview.liveHint")}
        </p>
      </div>

      <div className="max-h-[min(70vh,760px)] space-y-3 overflow-y-auto p-3">
        <div className="rounded-[22px] bg-white p-4 text-center shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-[.16em] text-[#0d9d99]">
            {organizationName}
          </p>
          <h3 className="mt-2 text-lg font-semibold leading-snug tracking-[-.03em] text-[#071426]">
            {t("visitor.waiting", { name: host || t("preview.sampleHost") })}
          </h3>
          {visitorName?.trim() && (
            <p className="mt-1 text-sm text-slate-500">
              {t("visitor.hello", { name: visitorName.trim().split(" ")[0] ?? visitorName })}
            </p>
          )}
          <div className="mt-4 space-y-2 text-left">
            {when && <Fact icon={CalendarClock} label={t("visitor.when")} value={when} />}
            {place && (
              <Fact
                icon={MapPin}
                label={t("visitor.where")}
                value={place}
                hint={locationAddress}
              />
            )}
            {reason && <Fact icon={FileCheck2} label={t("visitor.purpose")} value={reason} />}
            {accessRequirements?.trim() && (
              <Fact
                icon={ShieldCheck}
                label={t("visitor.requirements")}
                value={accessRequirements.trim()}
              />
            )}
            {internalPlace?.trim() && (
              <Fact
                icon={Building2}
                label={t("visitor.internalPlace")}
                value={internalPlace.trim()}
              />
            )}
            {meetingUrl && (
              <Fact
                icon={Link2}
                label={t("visitor.meetingLink")}
                value={t("visitor.openMeeting")}
                href={meetingUrl}
              />
            )}
          </div>
          <div className="mt-4 grid h-11 place-items-center rounded-2xl bg-[#10cfc9] text-sm font-semibold text-[#043b39]">
            {t("visitor.start")}
          </div>
        </div>

        <p className="px-1 text-[11px] font-semibold uppercase tracking-[.14em] text-slate-400">
          {t("preview.asked")}
        </p>

        {steps.length === 0 ? (
          <p className="rounded-2xl bg-white px-4 py-3 text-sm leading-6 text-slate-500">
            {t("preview.nothingElse")}
          </p>
        ) : (
          steps.map((step, index) => (
            <section key={step} className="rounded-[22px] bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold text-[#0d9d99]">
                    {t("preview.stepOf", { index: index + 1 })}
                  </p>
                  <h4 className="mt-0.5 font-semibold text-[#071426]">
                    {stepTitle(step, flow, t)}
                  </h4>
                </div>
                <PolicyBadge policy={policyOf(step, flow)} label={policyLabel(step, flow, t)} />
              </div>
              <StepBody
                step={step}
                flow={flow}
                visitorName={visitorName}
                email={email}
                phone={phone}
                company={company}
                privacyNotice={privacyNotice}
                organizationName={organizationName}
                retentionDays={retentionDays}
              />
            </section>
          ))
        )}
      </div>
    </aside>
  );
}

function stepTitle(
  step: RegistrationStep,
  flow: VisitorFlowConfig,
  t: (path: string, vars?: Record<string, string | number>) => string,
) {
  if (step === "identity") return t("visitor.yourData");
  if (step === "document") return t("visitor.identification");
  if (step === "vehicle") return t("visitor.yourVehicle");
  if (step === "attachments") return t("visitor.attachments");
  if (step === "consent") return t("visitor.privacy");
  if (extrasShowsVehicle(flow) && extrasShowsNotes(flow)) return t("visitor.extras");
  if (extrasShowsVehicle(flow)) return t("visitor.yourVehicle");
  return t("visitor.receptionNotes");
}

function policyOf(step: RegistrationStep, flow: VisitorFlowConfig): StepPolicy | null {
  if (step === "identity") return flow.identity;
  if (step === "document") return flow.identification;
  if (step === "vehicle") return flow.vehicle;
  if (step === "attachments") return flow.attachments;
  if (step === "consent") return flow.consent;
  return null;
}

function policyLabel(
  step: RegistrationStep,
  flow: VisitorFlowConfig,
  t: (path: string) => string,
) {
  const policy = policyOf(step, flow);
  if (!policy || policy === "off") return "";
  return t(`flow.${policy}`);
}

function PolicyBadge({ policy, label }: { policy: StepPolicy | null; label: string }) {
  if (!policy || policy === "off" || !label) return null;
  return (
    <span
      className={cn(
        "shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide",
        policy === "required"
          ? "bg-[#071426] text-white"
          : "bg-slate-100 text-slate-500",
      )}
    >
      {label}
    </span>
  );
}

function StepBody({
  step,
  flow,
  visitorName,
  email,
  phone,
  company,
  privacyNotice,
  organizationName,
  retentionDays,
}: {
  step: RegistrationStep;
  flow: VisitorFlowConfig;
  visitorName?: string;
  email?: string;
  phone?: string;
  company?: string;
  privacyNotice?: string;
  organizationName: string;
  retentionDays?: number;
}) {
  const { t } = useI18n();
  const optionalIdentity = flow.identity !== "required";

  if (step === "identity") {
    return (
      <div className="space-y-2.5">
        <Blank label={t("visitor.fullName")} value={visitorName} optional={optionalIdentity} />
        <Blank label={t("visitor.email")} value={email} optional={optionalIdentity} />
        <Blank label={t("visitor.phone")} value={phone} optional={optionalIdentity} />
        <Blank label={t("visitor.company")} value={company} optional={optionalIdentity} />
      </div>
    );
  }

  if (step === "document") {
    return (
      <div className="grid grid-cols-2 gap-2">
        <PhotoSlot label={t("docs.front")} />
        <PhotoSlot label={t("docs.back")} />
      </div>
    );
  }

  if (step === "vehicle") {
    return (
      <div className="space-y-2.5">
        <Blank label={t("visitor.plate")} />
        <PhotoSlot label={t("visitor.photoPlate")} />
      </div>
    );
  }

  if (step === "extras") {
    return (
      <div className="space-y-2.5">
        {extrasShowsVehicle(flow) && (
          <>
            <Blank label={t("visitor.plate")} optional />
            <PhotoSlot label={t("visitor.photoPlate")} />
          </>
        )}
        {extrasShowsNotes(flow) && (
          <Blank label={t("visitor.receptionNotes")} optional={flow.notes !== "required"} />
        )}
      </div>
    );
  }

  if (step === "attachments") {
    return <PhotoSlot label={t("visitor.addPhoto")} />;
  }

  const notice = privacyNotice?.trim() || t("visitor.noticeFallback");
  return (
    <div className="space-y-2.5">
      <div className="max-h-28 overflow-hidden rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-600">
        <p className="font-semibold text-[#071426]">
          {t("visitor.noticeTitle", { org: organizationName })}
        </p>
        <p className="mt-1 line-clamp-4 whitespace-pre-line">{notice}</p>
        {flow.identification !== "off" && retentionDays ? (
          <p className="mt-2">{t("visitor.retention", { days: retentionDays })}</p>
        ) : null}
      </div>
      <div className="flex items-start gap-2 text-xs leading-5 text-slate-600">
        <span className="mt-0.5 size-4 shrink-0 rounded border border-slate-300 bg-white" />
        {t("visitor.consent")}
      </div>
    </div>
  );
}

function Blank({
  label,
  value,
  optional = false,
}: {
  label: string;
  value?: string;
  optional?: boolean;
}) {
  const { t } = useI18n();
  const filled = Boolean(value?.trim());
  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-2">
        <p className="text-[11px] font-medium text-slate-500">{label}</p>
        {optional && (
          <span className="text-[10px] font-medium uppercase tracking-wide text-slate-400">
            {t("common.optional")}
          </span>
        )}
      </div>
      <div
        className={cn(
          "rounded-xl border px-3 py-2 text-sm",
          filled
            ? "border-slate-200 bg-white font-medium text-[#071426]"
            : "border-dashed border-slate-300 bg-slate-50 text-slate-400",
        )}
      >
        {filled ? value : t("preview.visitorFills")}
      </div>
    </div>
  );
}

function PhotoSlot({ label }: { label: string }) {
  return (
    <div className="flex h-16 flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-slate-300 bg-slate-50 text-[11px] text-slate-400">
      <Camera size={16} />
      {label}
    </div>
  );
}

function Fact({
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
    <div className="flex items-start gap-2.5 rounded-xl bg-slate-50 px-3 py-2.5">
      <Icon size={15} className="mt-0.5 shrink-0 text-slate-400" />
      <div className="min-w-0 text-left">
        <p className="text-[10px] uppercase tracking-wide text-slate-400">{label}</p>
        {href ? (
          <a
            href={href}
            target="_blank"
            rel="noreferrer"
            className="text-sm font-semibold leading-5 text-[#0d9d99] underline"
          >
            {value}
          </a>
        ) : (
          <p className="text-sm font-semibold leading-5 text-[#071426]">{value}</p>
        )}
        {hint && <p className="text-xs text-slate-500">{hint}</p>}
      </div>
    </div>
  );
}
