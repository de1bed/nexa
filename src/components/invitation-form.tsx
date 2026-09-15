"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CalendarClock,
  Check,
  Loader2,
  Mail,
  MapPin,
  MessageCircle,
  Plus,
  Send,
  Share2,
  Sparkles,
  UserRound,
  Wand2,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { useWorkspace } from "./workspace-provider";
import { Button, Callout, Card, Field, cn, fieldClass } from "./ui";
import { CopyField, ShareButton } from "./ui-client";
import { invitationSchema } from "@/lib/schemas";
import { visitPurposes, type Visit } from "@/lib/domain";
import { visitPurposeMessageKey } from "@/lib/i18n";
import { useI18n } from "./i18n-provider";

/** Una vía de envío. Solo se muestra si la instalación la tiene configurada. */
function ChannelOption({
  checked,
  onToggle,
  icon: Icon,
  label,
  hint,
  error,
}: {
  checked: boolean;
  onToggle: () => void;
  icon: LucideIcon;
  label: string;
  hint: string;
  error?: string;
}) {
  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        aria-pressed={checked}
        className={cn(
          "flex w-full items-start gap-3 rounded-2xl border p-4 text-left transition",
          checked ? "border-[#10cfc9] bg-[#10cfc9]/10" : "border-slate-200",
        )}
      >
        <span
          className={cn(
            "mt-0.5 grid size-6 shrink-0 place-items-center rounded-lg border-2 transition",
            checked ? "border-[#0d9d99] bg-[#10cfc9] text-white" : "border-slate-300",
          )}
        >
          {checked && <Check size={15} strokeWidth={3} />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2 text-sm font-semibold">
            <Icon size={16} />
            {label}
          </span>
          <span className="mt-0.5 block text-xs leading-5 text-slate-500">
            {hint}
          </span>
        </span>
      </button>
      {error && <p className="mt-2 text-xs font-medium text-red-500">{error}</p>}
    </div>
  );
}

function todayPlus(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function formatDateLong(dateString: string, locale: string): string {
  const date = new Date(dateString + "T12:00:00");
  return date.toLocaleDateString(locale, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

const durations = [30, 60, 90, 120];

function addMinutes(time: string, minutes: number) {
  const [hours, mins] = time.split(":").map(Number);
  const total = (hours ?? 9) * 60 + (mins ?? 0) + minutes;
  const nextHours = Math.floor(total / 60) % 24;
  const nextMinutes = total % 60;
  return `${String(nextHours).padStart(2, "0")}:${String(nextMinutes).padStart(2, "0")}`;
}

export function InvitationForm() {
  const { t, intl } = useI18n();
  const { locations, hosts, viewer, channels, createInvitation, live } =
    useWorkspace();
  const [created, setCreated] = useState<{ visit: Visit; url: string } | null>(
    null,
  );
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [form, setForm] = useState({
    visitorName: "",
    email: "",
    phone: "",
    company: "",
    locationId: "",
    hostId: "",
    date: todayPlus(1),
    startTime: "10:00",
    endTime: "11:00",
    purpose: visitPurposes[0] as string,
    notes: "",
    accessRequirements: "",
    sendEmail: false,
    sendWhatsApp: false,
  });

  const canDelegate = viewer.role !== "host";
  const activeLocation = useMemo(
    () => form.locationId || locations[0]?.id || "",
    [form.locationId, locations],
  );

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => {
      if (!current[key as string]) return current;
      const next = { ...current };
      delete next[key as string];
      return next;
    });
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const payload = { ...form, locationId: activeLocation };
    const parsed = invitationSchema.safeParse(payload);

    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      parsed.error.issues.forEach((issue) => {
        const key = String(issue.path[0] ?? "form");
        fieldErrors[key] ??= issue.message;
      });
      setErrors(fieldErrors);
      toast.error(t("common.formReview"));
      return;
    }

    const startsAt = new Date(`${payload.date}T${payload.startTime}`);
    const endsAt = new Date(`${payload.date}T${payload.endTime}`);
    if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) {
      setErrors({ date: t("common.invalidDate") });
      return;
    }

    setSubmitting(true);
    try {
      const result = await createInvitation({
        visitorName: payload.visitorName,
        email: payload.email,
        phone: payload.phone,
        company: payload.company,
        locationId: activeLocation,
        hostId: canDelegate ? payload.hostId || viewer.id : undefined,
        startsAt: startsAt.toISOString(),
        endsAt: endsAt.toISOString(),
        purpose: payload.purpose,
        notes: payload.notes || undefined,
        accessRequirements: payload.accessRequirements || undefined,
        sendEmail: payload.sendEmail,
        sendWhatsApp: payload.sendWhatsApp,
      });
      setCreated({ visit: result.visit, url: result.invitationUrl });
      toast.success(
        payload.sendEmail || payload.sendWhatsApp
          ? t("invite.createdSent")
          : t("invite.created"),
      );
    } catch (reason) {
      toast.error(
        reason instanceof Error
          ? reason.message
          : t("invite.createFail"),
      );
    } finally {
      setSubmitting(false);
    }
  }

  /* ------------------------------------------------------------------ */
  if (created)
    return (
      <div className="mx-auto max-w-xl">
        <Card className="p-6 text-center sm:p-8">
          <span className="animate-pop mx-auto grid size-16 place-items-center rounded-full bg-emerald-50 text-emerald-600">
            <Check size={32} strokeWidth={3} />
          </span>
          <h1 className="mt-5 text-2xl font-semibold tracking-[-.02em]">
            {t("invite.ready")}
          </h1>
          <p className="mx-auto mt-2 max-w-sm text-[15px] leading-6 text-slate-500">
            {created.visit.inviteeName
              ? t("invite.guestWill", { name: created.visit.inviteeName })
              : t("invite.guestWillAnon")}{" "}
            {t("invite.guestWillRest")}
          </p>

          <div className="mt-6 text-left">
            <CopyField value={created.url} />
          </div>

          <div className="mt-4">
            <ShareButton
              url={created.url}
              title={t("invite.shareTitle")}
              text={t("invite.shareText", {
                name: created.visit.inviteeName
                  ? ` ${created.visit.inviteeName}`
                  : "",
              })}
              className="w-full"
            >
              {t("invite.shareChannels")}
            </ShareButton>
          </div>

          <div className="mt-6 flex flex-col gap-2.5 sm:flex-row">
            <Link href={`/app/visits/${created.visit.id}`} className="flex-1">
              <Button variant="outline" block>
                {t("invite.viewVisit")}
              </Button>
            </Link>
            <Button
              variant="ghost"
              className="flex-1 border border-slate-200"
              onClick={() => {
                setCreated(null);
                setForm((current) => ({
                  ...current,
                  visitorName: "",
                  email: "",
                  phone: "",
                  company: "",
                  notes: "",
                }));
              }}
            >
              <Plus size={17} />
              {t("invite.createAnother")}
            </Button>
          </div>

          {!live && (
            <p className="mt-5 text-xs leading-5 text-slate-400">
              <Mail className="mr-1 inline" size={13} />
              {t("invite.showcaseNote")}
            </p>
          )}
        </Card>
      </div>
    );

  const noLocations = locations.length === 0;

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        href="/app/visits"
        className="mb-5 inline-flex items-center gap-2 text-sm text-slate-500"
      >
        <ArrowLeft size={16} />
        {t("invite.back")}
      </Link>

      <header className="mb-6">
        <p className="text-[13px] font-semibold text-[#0d9d99]">{t("invite.eyebrow")}</p>
        <h1 className="mt-1.5 text-[26px] font-semibold tracking-[-.03em] sm:text-3xl">
          {t("invite.heading")}
        </h1>
        <p className="mt-1.5 text-[15px] text-slate-500">
          {t("invite.subtitle")}
        </p>
      </header>

      {noLocations && (
        <Callout tone="warning" icon={MapPin} className="mb-5">
          {t("invite.noLocations")}{" "}
          <Link href="/app/locations" className="font-semibold underline">
            {t("invite.createFirst")}
          </Link>{" "}
          {t("invite.noLocationsRest")}
        </Callout>
      )}

      <form onSubmit={submit} className="space-y-5">
        <Card className="p-5 sm:p-6">
          <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="flex items-center gap-2 font-semibold">
                <UserRound size={18} />
                {t("invite.knownData")}
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                {t("invite.knownHint")}
              </p>
            </div>
            {(form.visitorName || form.email || form.phone || form.company) && (
              <button
                type="button"
                onClick={() => {
                  update("visitorName", "");
                  update("email", "");
                  update("phone", "");
                  update("company", "");
                  update("sendEmail", false);
                  update("sendWhatsApp", false);
                }}
                className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-700"
              >
                <Wand2 size={15} />
                {t("invite.clear")}
              </button>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("invite.fullName")} optional error={errors.visitorName}>
              <input
                className={fieldClass}
                autoComplete="off"
                placeholder={t("invite.namePlaceholder")}
                value={form.visitorName}
                onChange={(event) => update("visitorName", event.target.value)}
              />
            </Field>
            <Field label={t("invite.email")} optional error={errors.email}>
              <input
                type="email"
                inputMode="email"
                className={fieldClass}
                placeholder={t("invite.emailPlaceholder")}
                value={form.email}
                onChange={(event) => update("email", event.target.value)}
              />
            </Field>
            <Field label={t("invite.phone")} optional>
              <input
                type="tel"
                inputMode="tel"
                className={fieldClass}
                placeholder="55 1234 5678"
                value={form.phone}
                onChange={(event) => update("phone", event.target.value)}
              />
            </Field>
            <Field label={t("invite.company")} optional>
              <input
                className={fieldClass}
                placeholder={t("invite.companyPlaceholder")}
                value={form.company}
                onChange={(event) => update("company", event.target.value)}
              />
            </Field>
          </div>
        </Card>

        <Card className="p-5 sm:p-6">
          <h2 className="mb-5 flex items-center gap-2 font-semibold">
            <CalendarClock size={18} />
            {t("invite.agenda")}
          </h2>

          <div className="space-y-4">
            <Field label={t("invite.location")} error={errors.locationId}>
              <select
                className={fieldClass}
                value={activeLocation}
                onChange={(event) => update("locationId", event.target.value)}
              >
                {locations.map((location) => (
                  <option key={location.id} value={location.id}>
                    {location.name}
                  </option>
                ))}
              </select>
            </Field>

            {canDelegate && hosts.length > 0 && (
              <Field
                label={t("invite.host")}
                hint={t("invite.hostHint")}
              >
                <select
                  className={fieldClass}
                  value={form.hostId || viewer.id}
                  onChange={(event) => update("hostId", event.target.value)}
                >
                  {hosts.map((host) => (
                    <option key={host.id} value={host.id}>
                      {host.name}
                      {host.id === viewer.id ? ` ${t("invite.me")}` : ""}
                    </option>
                  ))}
                </select>
              </Field>
            )}

            <div className="grid gap-4 sm:grid-cols-3">
              <Field 
                label={t("invite.date")} 
                error={errors.date}
                hint={form.date ? formatDateLong(form.date, intl) : undefined}
              >
                <input
                  type="date"
                  className={fieldClass}
                  value={form.date}
                  min={todayPlus(0)}
                  onChange={(event) => update("date", event.target.value)}
                />
              </Field>
              <Field label={t("invite.start")}>
                <input
                  type="time"
                  className={fieldClass}
                  value={form.startTime}
                  onChange={(event) => {
                    update("startTime", event.target.value);
                    update("endTime", addMinutes(event.target.value, 60));
                  }}
                />
              </Field>
              <Field label={t("invite.end")} error={errors.endTime}>
                <input
                  type="time"
                  className={fieldClass}
                  value={form.endTime}
                  onChange={(event) => update("endTime", event.target.value)}
                />
              </Field>
            </div>

            <div className="flex flex-wrap gap-2">
              {durations.map((minutes) => (
                <button
                  key={minutes}
                  type="button"
                  onClick={() =>
                    update("endTime", addMinutes(form.startTime, minutes))
                  }
                  className={cn(
                    "h-9 rounded-full border px-3.5 text-sm font-medium transition",
                    form.endTime === addMinutes(form.startTime, minutes)
                      ? "border-[#10cfc9] bg-[#10cfc9]/12 text-[#0d9d99]"
                      : "border-slate-200 bg-white text-slate-600",
                  )}
                >
                  {minutes < 60 ? `${minutes} min` : `${minutes / 60} h`}
                </button>
              ))}
            </div>

            <Field label={t("invite.purpose")} error={errors.purpose}>
              <select
                className={fieldClass}
                value={form.purpose}
                onChange={(event) => update("purpose", event.target.value)}
              >
                {visitPurposes.map((purpose) => (
                  <option key={purpose} value={purpose}>
                    {t(visitPurposeMessageKey(purpose)) || purpose}
                  </option>
                ))}
              </select>
            </Field>

            <Field
              label={t("invite.access")}
              optional
              hint={t("invite.accessHint")}
            >
              <input
                className={fieldClass}
                placeholder={t("invite.accessPlaceholder")}
                value={form.accessRequirements}
                onChange={(event) =>
                  update("accessRequirements", event.target.value)
                }
              />
            </Field>

            <Field
              label={t("invite.notes")}
              optional
              hint={t("invite.notesHint")}
            >
              <textarea
                rows={3}
                className="w-full rounded-2xl border border-slate-200 bg-white p-4 text-[16px] outline-none focus:border-[#10aaa5] focus:ring-4 focus:ring-[#10cfc9]/15"
                value={form.notes}
                onChange={(event) => update("notes", event.target.value)}
              />
            </Field>
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="mb-1 font-semibold">{t("invite.deliveryTitle")}</h2>
          <p className="mb-4 text-sm text-slate-500">
            {t("invite.deliveryHint")}
          </p>

          <div className="space-y-2.5">
            {channels.email && (
              <ChannelOption
                checked={form.sendEmail}
                onToggle={() => update("sendEmail", !form.sendEmail)}
                icon={Mail}
                label={t("invite.emailSend")}
                hint={
                  form.email
                    ? t("invite.emailHintOn", { email: form.email })
                    : t("invite.emailHintOff")
                }
                error={form.sendEmail ? errors.email : undefined}
              />
            )}

            {channels.whatsapp && (
              <ChannelOption
                checked={form.sendWhatsApp}
                onToggle={() => update("sendWhatsApp", !form.sendWhatsApp)}
                icon={MessageCircle}
                label={t("invite.whatsapp")}
                hint={
                  form.phone
                    ? t("invite.phoneHintOn", { phone: form.phone })
                    : t("invite.phoneHintOff")
                }
                error={form.sendWhatsApp ? errors.phone : undefined}
              />
            )}

            {!channels.email && !channels.whatsapp && (
              <Callout tone="neutral" icon={Share2}>
                {t("invite.noChannels")}
              </Callout>
            )}
          </div>
        </Card>

        {/* En móvil la acción queda siempre al alcance del pulgar, sobre un
            fondo sólido para que no se lea el formulario por detrás. */}
        <div className="sticky bottom-[calc(84px+env(safe-area-inset-bottom))] z-10 -mx-4 bg-gradient-to-t from-[#f4f7fb] via-[#f4f7fb] to-transparent px-4 pb-2 pt-4 lg:static lg:mx-0 lg:bg-none lg:p-0">
          <Button
            type="submit"
            variant="accent"
            size="lg"
            block
            disabled={submitting || noLocations}
            className="shadow-[0_18px_40px_-18px_#10cfc9]"
          >
            {submitting ? (
              <Loader2 size={19} className="animate-spin" />
            ) : form.sendEmail || form.sendWhatsApp ? (
              <Send size={19} />
            ) : (
              <Sparkles size={19} />
            )}
            {submitting
              ? t("invite.creating")
              : form.sendEmail || form.sendWhatsApp
                ? t("invite.createSend")
                : t("invite.create")}
          </Button>
        </div>
      </form>
    </div>
  );
}
