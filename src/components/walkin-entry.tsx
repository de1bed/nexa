/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useState } from "react";
import { KeyRound, Loader2, LockKeyhole, UserRoundCheck } from "lucide-react";
import { Brand } from "./brand";
import { LanguageSwitcher } from "./language-switcher";
import { Button, Field, fieldClass } from "./ui";
import { useI18n } from "./i18n-provider";
import { isLiveMode } from "@/lib/config";
import { visitPurposes } from "@/lib/domain";
import { visitPurposeMessageKey } from "@/lib/i18n";
import { showcaseOrganization, showcaseLocations, showcaseTeam } from "@/lib/demo-data";
import { DEMO_INVITE_TOKEN } from "@/lib/demo-public";

type Point = { organizationName: string; locationName: string; logoUrl: string | null };
type HostOption = { id: string; name: string; department: string };

const DEMO_CODE = "1234";

/**
 * Registro sin cita: QR impreso -> código de 4 dígitos -> a quién visita ->
 * registro normal de la invitación, que termina con el pase.
 */
export function WalkinEntry({ token }: { token: string }) {
  const live = isLiveMode();
  const { t } = useI18n();
  const [point, setPoint] = useState<Point | null>(
    live
      ? null
      : {
          organizationName: showcaseOrganization.name,
          locationName: showcaseLocations[0]?.name ?? "",
          logoUrl: null,
        },
  );
  const [unavailable, setUnavailable] = useState(false);
  const [code, setCode] = useState("");
  const [hosts, setHosts] = useState<HostOption[] | null>(null);
  const [form, setForm] = useState({
    visitorName: "",
    company: "",
    hostId: "",
    purpose: t(visitPurposeMessageKey(visitPurposes[0])) || visitPurposes[0],
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!live) return;
    let active = true;
    void (async () => {
      try {
        const response = await fetch(
          `/api/public/walkin/${encodeURIComponent(token)}`,
          { cache: "no-store" },
        );
        if (!response.ok) throw new Error("unavailable");
        const payload = (await response.json()) as Point;
        if (active) setPoint(payload);
      } catch {
        if (active) setUnavailable(true);
      }
    })();
    return () => {
      active = false;
    };
  }, [live, token]);

  async function verify(event: React.FormEvent) {
    event.preventDefault();
    if (!/^\d{4}$/.test(code)) return setError(t("walkin.codeLabel"));
    setBusy(true);
    setError("");
    try {
      if (!live) {
        if (code !== DEMO_CODE) throw new Error(t("walkin.wrongCodeShort"));
        setHosts(
          showcaseTeam
            .filter((member) => member.role !== "guard")
            .map((member) => ({
              id: member.id,
              name: member.name,
              department: member.department ?? "",
            })),
        );
        return;
      }
      const response = await fetch(
        `/api/public/walkin/${encodeURIComponent(token)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code }),
        },
      );
      const payload = (await response.json()) as {
        hosts?: HostOption[];
        state?: string;
        attemptsLeft?: number;
      };
      if (payload.state === "invalid") return setUnavailable(true);
      if (payload.state === "locked") throw new Error(t("walkin.locked"));
      if (payload.state === "wrong_code")
        throw new Error(
          t("walkin.wrongCode", { n: payload.attemptsLeft ?? 0 }),
        );
      if (!response.ok || !payload.hosts) throw new Error(t("walkin.failed"));
      setHosts(payload.hosts);
    } catch (reason) {
      setCode("");
      setError(reason instanceof Error ? reason.message : t("walkin.failed"));
    } finally {
      setBusy(false);
    }
  }

  async function start(event: React.FormEvent) {
    event.preventDefault();
    if (form.visitorName.trim().length < 2) return setError(t("walkin.nameRequired"));
    if (!form.hostId) return setError(t("walkin.hostRequired"));
    if (form.purpose.trim().length < 2) return setError(t("walkin.purposeRequired"));
    setBusy(true);
    setError("");
    try {
      if (!live) {
        window.location.assign(`/visit/${DEMO_INVITE_TOKEN}`);
        return;
      }
      const response = await fetch(
        `/api/public/walkin/${encodeURIComponent(token)}/start`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code, ...form }),
        },
      );
      const payload = (await response.json()) as {
        invitationPath?: string;
        error?: string;
        state?: string;
      };
      if (!response.ok || !payload.invitationPath) {
        // El código cambió mientras llenaba el formulario: vuelve a pedirlo.
        if (payload.state === "wrong_code" || payload.state === "locked") {
          setHosts(null);
          setCode("");
        }
        throw new Error(payload.error ?? t("walkin.failed"));
      }
      window.location.assign(payload.invitationPath);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t("walkin.failed"));
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-[100dvh] flex-col bg-[#f4f7fb]">
      <header className="safe-top sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur-lg">
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
      </header>

      <div className="safe-bottom mx-auto w-full max-w-2xl flex-1 px-4 pb-8 pt-6 sm:px-6 sm:pt-10">
        <div className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-[0_1px_2px_rgba(7,20,38,.04),0_18px_48px_-30px_rgba(7,20,38,.4)] sm:p-8">
          {unavailable ? (
            <div className="py-10 text-center">
              <h1 className="text-xl font-semibold">{t("walkin.unavailableTitle")}</h1>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                {t("walkin.unavailable")}
              </p>
            </div>
          ) : !point ? (
            <div className="py-16 text-center">
              <Loader2 className="mx-auto animate-spin text-[#10aaa5]" size={34} />
            </div>
          ) : (
            <>
              <div className="flex items-center gap-4">
                {point.logoUrl ? (
                  <img
                    src={point.logoUrl}
                    alt={point.organizationName}
                    className="size-14 shrink-0 rounded-2xl border border-slate-200 bg-white object-contain p-1.5"
                  />
                ) : null}
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold uppercase tracking-[.16em] text-[#0d9d99]">
                    {point.organizationName}
                  </p>
                  <p className="truncate text-sm text-slate-500">{point.locationName}</p>
                </div>
              </div>

              {!hosts ? (
                <form onSubmit={verify} className="mt-7">
                  <span className="grid size-14 place-items-center rounded-2xl bg-[#10cfc9]/15 text-[#0d9d99]">
                    <KeyRound size={26} />
                  </span>
                  <h1 className="mt-4 text-[26px] font-semibold leading-tight tracking-[-.03em]">
                    {t("walkin.codeTitle")}
                  </h1>
                  <p className="mt-2 text-[15px] leading-6 text-slate-500">
                    {t("walkin.codeHint")}
                  </p>
                  <input
                    autoFocus
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    pattern="[0-9]*"
                    maxLength={4}
                    aria-label={t("walkin.codeLabel")}
                    value={code}
                    onChange={(event) =>
                      setCode(event.target.value.replace(/\D/g, "").slice(0, 4))
                    }
                    className="mt-6 h-20 w-full rounded-2xl border border-slate-200 bg-white text-center font-mono text-[40px] font-semibold tracking-[.5em] outline-none focus:border-[#10aaa5] focus:ring-4 focus:ring-[#10cfc9]/15"
                  />
                  {!live && (
                    <p className="mt-2 text-center text-xs text-slate-400">
                      {t("walkin.demoCode", { code: DEMO_CODE })}
                    </p>
                  )}
                  {error && (
                    <p role="alert" className="mt-4 rounded-2xl bg-red-50 p-3 text-sm text-red-700">
                      {error}
                    </p>
                  )}
                  <Button
                    type="submit"
                    variant="accent"
                    size="lg"
                    block
                    className="mt-6"
                    disabled={busy || code.length !== 4}
                  >
                    {busy && <Loader2 size={18} className="animate-spin" />}
                    {t("walkin.verify")}
                  </Button>
                </form>
              ) : (
                <form onSubmit={start} className="mt-7 space-y-4">
                  <span className="grid size-14 place-items-center rounded-2xl bg-[#10cfc9]/15 text-[#0d9d99]">
                    <UserRoundCheck size={26} />
                  </span>
                  <div>
                    <h1 className="text-[26px] font-semibold leading-tight tracking-[-.03em]">
                      {t("walkin.formTitle")}
                    </h1>
                    <p className="mt-2 text-[15px] leading-6 text-slate-500">
                      {t("walkin.formHint")}
                    </p>
                  </div>
                  <Field label={t("walkin.name")}>
                    <input
                      autoFocus
                      autoComplete="name"
                      maxLength={120}
                      className={fieldClass}
                      value={form.visitorName}
                      onChange={(event) =>
                        setForm({ ...form, visitorName: event.target.value })
                      }
                    />
                  </Field>
                  <Field label={t("walkin.company")} optional>
                    <input
                      autoComplete="organization"
                      maxLength={120}
                      className={fieldClass}
                      value={form.company}
                      onChange={(event) =>
                        setForm({ ...form, company: event.target.value })
                      }
                    />
                  </Field>
                  <Field label={t("walkin.host")}>
                    <select
                      className={fieldClass}
                      value={form.hostId}
                      onChange={(event) =>
                        setForm({ ...form, hostId: event.target.value })
                      }
                    >
                      <option value="">{t("walkin.hostPlaceholder")}</option>
                      {hosts.map((host) => (
                        <option key={host.id} value={host.id}>
                          {host.department
                            ? `${host.name} · ${host.department}`
                            : host.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label={t("walkin.purpose")}>
                    <input
                      list="walkin-purposes"
                      maxLength={160}
                      className={fieldClass}
                      value={form.purpose}
                      onChange={(event) =>
                        setForm({ ...form, purpose: event.target.value })
                      }
                    />
                    <datalist id="walkin-purposes">
                      {visitPurposes.map((purpose) => (
                        <option
                          key={purpose}
                          value={t(visitPurposeMessageKey(purpose)) || purpose}
                        />
                      ))}
                    </datalist>
                  </Field>
                  {error && (
                    <p role="alert" className="rounded-2xl bg-red-50 p-3 text-sm text-red-700">
                      {error}
                    </p>
                  )}
                  <Button
                    type="submit"
                    variant="accent"
                    size="lg"
                    block
                    disabled={busy}
                  >
                    {busy && <Loader2 size={18} className="animate-spin" />}
                    {busy ? t("walkin.starting") : t("walkin.start")}
                  </Button>
                </form>
              )}
            </>
          )}
        </div>
      </div>
    </main>
  );
}
