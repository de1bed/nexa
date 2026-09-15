"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, MailCheck, RotateCcw } from "lucide-react";
import { Button, cn, fieldClass } from "./ui";
import { useI18n } from "./i18n-provider";
import { translate } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/client";
import { accessCodeSchema } from "@/lib/schemas";

/**
 * Espera antes de habilitar el reenvío. Coincide con el intervalo mínimo del
 * proyecto de Supabase (60 s entre códigos al mismo correo), así que el botón
 * se enciende justo cuando el servidor acepta otro envío. Si algún día no
 * coinciden, el mensaje de error dice cuántos segundos faltan.
 */
const resendDelaySeconds = 60;

/**
 * Traduce los errores de Supabase Auth a algo accionable. Lo que no
 * reconocemos cae en un mensaje genérico para no exponer detalles internos.
 */
export function accessRequestError(message: string) {
  const detail = message.toLowerCase();
  if (detail.includes("signups not allowed")) return translate("auth.noAccount");
  if (detail.includes("rate limit") || detail.includes("security purposes")) {
    const seconds = /after (\d+) second/.exec(detail)?.[1];
    return seconds
      ? translate("auth.waitSeconds", { n: seconds })
      : translate("auth.waitMoment");
  }
  if (detail.includes("invalid") && detail.includes("email"))
    return translate("auth.invalidEmail");
  return translate("auth.sendFail");
}

/**
 * Segundo paso de la autenticación: el código de un solo uso que llegó por
 * correo. Se valida en cuanto hay seis dígitos, así que en teléfonos con
 * autorrelleno la sesión se abre sin tocar ningún botón.
 */
export function AccessCodeStep({
  email,
  title,
  description,
  otpType = "email",
  onVerified,
  onResend,
  onBack,
}: {
  email: string;
  title: string;
  description: string;
  otpType?: "email" | "magiclink";
  onVerified: () => void | Promise<void>;
  onResend: () => Promise<void>;
  onBack: () => void;
}) {
  const { t } = useI18n();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [wait, setWait] = useState(resendDelaySeconds);
  const running = useRef(false);

  useEffect(() => {
    if (wait <= 0) return;
    const timer = setTimeout(() => setWait((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [wait]);

  async function verify(value: string) {
    const parsed = accessCodeSchema.safeParse(value);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? t("auth.invalidCode"));
      return;
    }
    if (running.current) return;
    running.current = true;
    setBusy(true);
    setError("");
    try {
      const client = createClient();
      let result = await client.auth.verifyOtp({
        email,
        token: parsed.data,
        type: otpType,
      });
      if ((result.error || !result.data.session) && otpType !== "email") {
        result = await client.auth.verifyOtp({
          email,
          token: parsed.data,
          type: "email",
        });
      }
      if (result.error || !result.data.session) throw new Error("invalid");
      await onVerified();
    } catch {
      setError(t("auth.codeExpired"));
      setCode("");
      setBusy(false);
    } finally {
      running.current = false;
    }
  }

  async function resend() {
    setBusy(true);
    setError("");
    setCode("");
    try {
      await onResend();
      setWait(resendDelaySeconds);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : t("auth.resendFail"),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="text-center">
      <span className="animate-pop mx-auto grid size-16 place-items-center rounded-full bg-[#10cfc9]/15 text-[#0d9d99]">
        <MailCheck size={30} />
      </span>
      <h1 className="mt-5 text-[26px] font-semibold leading-tight tracking-[-.03em]">
        {title}
      </h1>
      <p className="mt-2.5 text-[15px] leading-6 text-slate-500">
        {description} {t("auth.sentTo")}{" "}
        <b className="text-[#071426]">{email}</b>.
      </p>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          void verify(code);
        }}
        className="mt-7"
      >
        <label htmlFor="access-code" className="sr-only">
          {t("auth.sixDigit")}
        </label>
        <input
          id="access-code"
          autoFocus
          required
          value={code}
          disabled={busy}
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          placeholder="······"
          aria-invalid={Boolean(error)}
          aria-describedby={error ? "access-code-error" : undefined}
          onChange={(event) => {
            const digits = event.target.value.replace(/\D/g, "").slice(0, 6);
            setCode(digits);
            setError("");
            if (digits.length === 6) void verify(digits);
          }}
          className={cn(
            fieldClass,
            "h-16 text-center text-[28px] font-semibold tracking-[.4em] [text-indent:.4em]",
          )}
        />

        {error && (
          <p
            id="access-code-error"
            role="alert"
            className="mt-4 rounded-2xl bg-red-50 p-3.5 text-left text-sm text-red-700"
          >
            {error}
          </p>
        )}

        <Button
          type="submit"
          size="lg"
          block
          disabled={busy || code.length < 6}
          className="mt-5"
        >
          {busy ? <Loader2 size={19} className="animate-spin" /> : t("auth.enter")}
        </Button>
      </form>

      <div className="mt-5 flex items-center justify-center gap-5 text-sm">
        <button
          type="button"
          onClick={onBack}
          className="font-medium text-slate-500"
        >
          {t("auth.changeEmail")}
        </button>
        <span aria-hidden className="text-slate-300">
          ·
        </span>
        <button
          type="button"
          onClick={() => void resend()}
          disabled={busy || wait > 0}
          className="inline-flex items-center gap-1.5 font-semibold text-blue-600 disabled:text-slate-400"
        >
          <RotateCcw size={15} />
          {wait > 0 ? t("auth.resendIn", { n: wait }) : t("auth.resend")}
        </button>
      </div>
    </div>
  );
}
