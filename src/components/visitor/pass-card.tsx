/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Building2, CalendarClock, Hourglass, Link2, MapPin, ShieldCheck, UserRound } from "lucide-react";
import { cn } from "../ui";
import { RemainingUntil } from "../ui-client";
import { useI18n } from "../i18n-provider";

/**
 * Tarjeta del pase. El QR codifica únicamente un token aleatorio: no lleva
 * nombre, correo ni identificación en el propio código.
 */
export function PassCard({
  token,
  visitorName,
  organizationName,
  hostName,
  location,
  startsAt,
  expiresAt,
  state = "valid",
  accessRequirements,
  internalPlace,
  meetingUrl,
}: {
  token: string;
  visitorName: string;
  organizationName?: string;
  hostName: string;
  location: string;
  startsAt: string;
  expiresAt?: string;
  state?: "valid" | "used" | "expired" | "revoked";
  accessRequirements?: string;
  internalPlace?: string;
  meetingUrl?: string;
}) {
  const { t, formatFullDate, formatDateTime } = useI18n();
  const [qr, setQr] = useState("");

  useEffect(() => {
    let active = true;
    QRCode.toDataURL(token, {
      width: 520,
      margin: 1,
      errorCorrectionLevel: "M",
      color: { dark: "#071426", light: "#ffffff" },
    })
      .then((url) => {
        if (active) setQr(url);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [token]);

  const dateLabel = formatFullDate(startsAt);

  const inactive = state !== "valid";
  const visitStart = new Date(startsAt).getTime();
  const showEarlyNote = !inactive && Number.isFinite(visitStart);

  return (
    <div className="animate-pop mx-auto w-full max-w-sm overflow-hidden rounded-[28px] bg-white shadow-[0_28px_70px_-32px_rgba(7,20,38,.5)] ring-1 ring-slate-200">
      <div className="dark-panel px-6 pb-8 pt-6 text-center text-white">
        <p className="text-[11px] font-semibold tracking-[.22em] text-[#10cfc9]">
          {t("landing.passAccess")}
        </p>
        {organizationName && (
          <p className="mt-1.5 text-lg font-semibold">{organizationName}</p>
        )}

        <div
          className={cn(
            "relative mx-auto mt-6 w-fit rounded-3xl bg-white p-3 shadow-lg",
            inactive && "opacity-40 grayscale",
          )}
        >
          {qr ? (
            <img
              src={qr}
              alt={t("pass.qrAlt")}
              width={240}
              height={240}
              className="size-56 rounded-xl"
            />
          ) : (
            <div className="shimmer size-56 rounded-xl" />
          )}
          {inactive && (
            <span className="absolute inset-0 grid place-items-center rounded-3xl">
              <span className="rounded-full bg-slate-900/85 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white">
                {state === "used"
                  ? t("pass.usedLabel")
                  : state === "expired"
                    ? t("pass.expired")
                    : t("pass.revoked")}
              </span>
            </span>
          )}
        </div>

        {/* Código textual para entrada manual */}
        <p className="mt-4 font-mono text-sm tracking-wider text-slate-300">
          {token.slice(0, 4).toUpperCase()}-{token.slice(4, 8).toUpperCase()}-{token.slice(8, 12).toUpperCase()}
        </p>
        <p className="mt-0.5 text-[10px] text-slate-400">
          {t("pass.manualCode")}
        </p>

        <p className="mt-4 text-xl font-semibold tracking-[-.02em]">
          {visitorName}
        </p>
      </div>

      {/* Perforado de boleto */}
      <div className="relative h-6 bg-white">
        <span className="absolute -left-3 top-0 size-6 rounded-full bg-[#f4f7fb]" />
        <span className="absolute -right-3 top-0 size-6 rounded-full bg-[#f4f7fb]" />
        <span className="absolute inset-x-6 top-1/2 border-t-2 border-dashed border-slate-200" />
      </div>

      <div className="space-y-3.5 px-6 pb-7">
        <Row icon={UserRound} label={t("pass.host")} value={hostName} />
        <Row icon={MapPin} label={t("pass.location")} value={location} />
        {internalPlace && (
          <Row icon={Building2} label={t("visitor.internalPlace")} value={internalPlace} />
        )}
        {meetingUrl && (
          <Row
            icon={Link2}
            label={t("visitor.meetingLink")}
            value={t("visitor.openMeeting")}
            href={meetingUrl}
          />
        )}
        <Row icon={CalendarClock} label={t("pass.schedule")} value={dateLabel} />
        {expiresAt && (
          <div className="flex items-start gap-3">
            <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl bg-teal-50 text-[#0d9d99]">
              <Hourglass size={17} />
            </span>
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-wide text-slate-400">
                {t("pass.validUntil")}
              </p>
              <p className="mt-0.5 text-sm font-medium leading-5 text-[#071426]">
                {formatDateTime(expiresAt)}
              </p>
              {!inactive && (
                <p className="mt-0.5 text-xs font-semibold text-[#0d9d99]">
                  {t("pass.remaining")}: <RemainingUntil until={expiresAt} />
                </p>
              )}
            </div>
          </div>
        )}
        {accessRequirements && (
          <Row
            icon={ShieldCheck}
            label={t("pass.accessReq")}
            value={accessRequirements}
          />
        )}
        {showEarlyNote && (
          <p className="rounded-2xl bg-slate-50 px-3.5 py-3 text-[12px] leading-5 text-slate-500">
            {t("pass.earlyNote")}
          </p>
        )}
      </div>
    </div>
  );
}

function Row({
  icon: Icon,
  label,
  value,
  href,
}: {
  icon: typeof UserRound;
  label: string;
  value: string;
  href?: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl bg-slate-50 text-slate-500">
        <Icon size={17} />
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
            className="mt-0.5 block break-all text-sm font-medium leading-5 text-[#0d9d99] underline"
          >
            {value}
          </a>
        ) : (
          <p className="mt-0.5 text-sm font-medium leading-5 text-[#071426]">
            {value}
          </p>
        )}
      </div>
    </div>
  );
}
