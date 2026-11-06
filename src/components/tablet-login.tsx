"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { Button, Field, fieldClass } from "./ui";
import { useI18n } from "./i18n-provider";
import { findDemoGuardByCode } from "@/lib/demo-guard-codes";
import { findDemoStation } from "@/lib/demo-stations";
import { clearDemoSession, writeDemoSession } from "@/lib/demo-public";
import { isLiveMode, roleHome } from "@/lib/config";
import { formatCompanyCode, normalizeCompanyCode } from "@/lib/station-access";
import { normalizeGuardCode } from "@/lib/guard-code";

const MASK = "••••••••";

/**
 * La tableta se abre con clave de empresa + usuario.
 * El código de guardia solo cambia quién está de turno.
 * En el cambio de guardia las dos primeras van censuradas: el valor real
 * no está en la página.
 */
export function TabletLogin({
  mode,
  demo = false,
  plain = false,
}: {
  mode: "login" | "switch";
  demo?: boolean;
  plain?: boolean;
}) {
  const router = useRouter();
  const live = isLiveMode();
  const { t } = useI18n();
  const switching = mode === "switch";
  const [companyCode, setCompanyCode] = useState("");
  const [username, setUsername] = useState("");
  const [guardCode, setGuardCode] = useState("");
  const [unlocked, setUnlocked] = useState(switching);
  const [showKey, setShowKey] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function unlock(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const normalizedCode = normalizeCompanyCode(companyCode);
    const normalizedUser = username.trim().toLowerCase();
    try {
      const station = live ? null : findDemoStation(normalizedCode, normalizedUser);
      if (!live && !station) throw new Error(t("login.tabletFail"));
      const response = await fetch("/api/auth/station", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyCode: normalizedCode,
          username: normalizedUser,
          demoStationId: station?.id,
          demoBoothId: station?.boothId,
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        errorType?: "invalid_code" | "user_not_found" | "generic";
      };
      if (!response.ok) {
        if (payload.errorType === "invalid_code") {
          throw new Error(t("login.tabletCodeInvalid"));
        } else if (payload.errorType === "user_not_found") {
          throw new Error(t("login.tabletUserNotFound"));
        }
        throw new Error(payload.error ?? t("login.tabletFail"));
      }
      setCompanyCode("");
      setUsername("");
      setUnlocked(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t("login.tabletFail"));
    } finally {
      setBusy(false);
    }
  }

  async function enterGuard(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const normalizedGuardCode = normalizeGuardCode(guardCode);
    try {
      const station = await fetch("/api/auth/station", { cache: "no-store" });
      const stationPayload = (await station.json().catch(() => ({}))) as { open?: boolean };
      if (!stationPayload.open) throw new Error(t("login.tabletClosed"));

      let redirect: Route = roleHome.guard;
      if (!live) {
        const found = findDemoGuardByCode(normalizedGuardCode);
        if (!found) throw new Error(t("login.guardCodeFail"));
        writeDemoSession("guard", found);
      } else {
        const response = await fetch("/api/auth/guard-code", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code: normalizedGuardCode }),
        });
        const payload = (await response.json().catch(() => ({}))) as {
          error?: string;
          redirect?: string;
        };
        if (!response.ok) throw new Error(payload.error ?? t("login.guardCodeFail"));
        clearDemoSession();
        redirect = (payload.redirect ?? roleHome.guard) as Route;
      }
      sessionStorage.setItem("nexa-guard-welcome", "1");
      router.push(redirect);
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t("login.guardCodeFail"));
    } finally {
      setBusy(false);
    }
  }

  const companyShown = unlocked ? MASK : formatCompanyCode(companyCode);
  const userShown = unlocked ? MASK : username;

  return (
    <form
      onSubmit={unlocked ? enterGuard : unlock}
      className={
        switching || plain ? "mt-8 space-y-4" : "mt-8 space-y-4 border-t border-slate-200 pt-6"
      }
    >
      {!plain && (
        <div>
          <p className={`text-sm font-semibold ${switching ? "text-white" : ""}`}>
            {switching ? t("guard.switchGuard") : t("login.tabletTitle")}
          </p>
          <p className={`mt-1 text-xs leading-5 ${switching ? "text-slate-400" : "text-slate-500"}`}>
            {switching ? t("guard.switchHint") : t("login.tabletHint")}
          </p>
        </div>
      )}

      <Field
        label={t("login.tabletCompany")}
        dark={switching}
        hint={unlocked ? undefined : t("login.tabletCompanyHint")}
      >
        {/* La clave se puede mostrar con el ojo para revisar lo escrito.
            El ejemplo nunca es una clave real. */}
        <div className="relative">
          <input
            required={!unlocked}
            type={unlocked || !showKey ? "password" : "text"}
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            autoCapitalize="characters"
            disabled={unlocked || busy}
            className={`${fieldClass} pr-12`}
            placeholder={unlocked ? undefined : demo ? "NOVA-2026" : "NEXA-XXXXXX"}
            value={companyShown}
            onChange={(event) => setCompanyCode(event.target.value.toUpperCase())}
          />
          {!unlocked && (
            <button
              type="button"
              onClick={() => setShowKey((current) => !current)}
              className="absolute inset-y-0 right-0 grid w-12 place-items-center text-slate-500"
              aria-label={showKey ? t("login.hideKey") : t("login.showKey")}
              aria-pressed={showKey}
            >
              {showKey ? <EyeOff size={19} /> : <Eye size={19} />}
            </button>
          )}
        </div>
      </Field>
      <Field
        label={t("login.tabletUser")}
        dark={switching}
        hint={unlocked ? undefined : t("login.tabletUserHint")}
      >
        {/* El usuario no es secreto: se ve al escribirlo. Tras abrir, se censura. */}
        <input
          required={!unlocked}
          type={unlocked ? "password" : "text"}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          autoCapitalize="none"
          disabled={unlocked || busy}
          className={fieldClass}
          placeholder={unlocked ? undefined : demo ? "norte" : "caseta.norte"}
          value={userShown}
          onChange={(event) => setUsername(event.target.value.toLowerCase())}
        />
      </Field>

      {unlocked && (
        <Field label={t("login.guardCode")} dark={switching}>
          <input
            required
            autoFocus
            inputMode="text"
            autoCapitalize="characters"
            autoComplete="off"
            className={fieldClass}
            placeholder={t("login.guardCodePlaceholder")}
            value={guardCode}
            onChange={(event) => setGuardCode(event.target.value.toUpperCase())}
          />
        </Field>
      )}

      {demo && !switching && (
        <p className="text-xs leading-5 text-slate-500">{t("login.tabletDemo")}</p>
      )}
      {error && (
        <p
          role="alert"
          className={`rounded-2xl p-3.5 text-sm ${
            switching ? "bg-red-500/15 text-red-100" : "bg-red-50 text-red-700"
          }`}
        >
          {error}
        </p>
      )}
      <Button type="submit" size="lg" block disabled={busy}>
        {busy ? (
          <Loader2 size={19} className="animate-spin" />
        ) : unlocked ? (
          t("login.enter")
        ) : (
          t("login.tabletContinue")
        )}
      </Button>
    </form>
  );
}
