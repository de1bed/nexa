"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import type { Route } from "next";
import {
  ArrowRight,
  Loader2,
  LockKeyhole,
  ShieldCheck,
  UserRound,
  Users,
} from "lucide-react";
import { Brand } from "./brand";
import { AccessCodeStep, accessRequestError } from "./access-code";
import { ChoosePasswordStep } from "./choose-password";
import { LanguageSwitcher } from "./language-switcher";
import { useI18n } from "./i18n-provider";
import { Button, Callout, Field, fieldClass } from "./ui";
import { createClient } from "@/lib/supabase/client";
import { destinationAfterLogin, isLiveMode, roleHome } from "@/lib/config";
import { accessEmailSchema, signInSchema } from "@/lib/schemas";
import { SHOWCASE_ROLE_COOKIE } from "@/lib/session-constants";
import type { MemberRole } from "@/lib/domain";

const showcaseProfiles: Array<{
  role: Exclude<MemberRole, "superadmin">;
  descKey: "login.adminDesc" | "login.hostDesc" | "login.guardDesc";
  icon: typeof Users;
}> = [
  { role: "admin", descKey: "login.adminDesc", icon: Users },
  { role: "host", descKey: "login.hostDesc", icon: UserRound },
  { role: "guard", descKey: "login.guardDesc", icon: ShieldCheck },
];

/** Marca el perfil elegido en modo vitrina; no es un mecanismo de seguridad. */
function rememberShowcaseRole(role: MemberRole) {
  document.cookie = `${SHOWCASE_ROLE_COOKIE}=${role}; path=/; max-age=86400; samesite=lax`;
}

/**
 * El código por correo solo confirma la identidad la primera vez (o si
 * olvidaste la contraseña). El día a día es correo + contraseña.
 */
export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const live = isLiveMode();
  const { t } = useI18n();

  const invitedEmail = accessEmailSchema.safeParse(
    params.get("email")?.trim().toLowerCase() ?? "",
  );
  const initialEmail = invitedEmail.success ? invitedEmail.data : "";
  const fromInvite = params.get("welcome") === "1" && Boolean(initialEmail);

  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState("");
  const [sentTo, setSentTo] = useState(fromInvite ? initialEmail : "");
  const [inviteCode, setInviteCode] = useState(fromInvite);
  const [choosePassword, setChoosePassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(
    params.get("error") === "invalid_link" ? t("login.expiredLink") : "",
  );

  function enterShowcase(role: Exclude<MemberRole, "superadmin">) {
    rememberShowcaseRole(role);
    router.push(roleHome[role]);
    router.refresh();
  }

  async function sendCode(address: string) {
    const { error: authError } = await createClient().auth.signInWithOtp({
      email: address,
      // Iniciar sesión no debe crear cuentas: para eso está el registro.
      options: { shouldCreateUser: false },
    });
    if (authError) throw new Error(accessRequestError(authError.message));
  }

  async function signIn(event: React.FormEvent) {
    event.preventDefault();
    const parsed = signInSchema.safeParse({
      email: email.trim().toLowerCase(),
      password,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? t("login.checkData"));
      return;
    }

    setBusy(true);
    setError("");
    try {
      const { error: authError } = await createClient().auth.signInWithPassword({
        email: parsed.data.email,
        password: parsed.data.password,
      });
      if (authError) {
        throw new Error(t("login.wrongPassword"));
      }
      await finishSignIn();
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : t("login.enterFail"),
      );
    } finally {
      setBusy(false);
    }
  }

  async function requestCode() {
    const parsed = accessEmailSchema.safeParse(email.trim().toLowerCase());
    if (!parsed.success) {
      setError(t("login.validEmail"));
      return;
    }

    setBusy(true);
    setError("");
    try {
      await sendCode(parsed.data);
      setSentTo(parsed.data);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : t("login.sendFail"),
      );
    } finally {
      setBusy(false);
    }
  }

  async function finishSignIn() {
    const next = params.get("next");
    try {
      await createClient().auth.getSession();
      let memberships: Array<{ role: MemberRole }> | null = null;
      let platformAdmin = false;
      for (let attempt = 0; attempt < 3; attempt += 1) {
        const response = await fetch("/api/session", { cache: "no-store" });
        if (response.ok) {
          const payload = (await response.json()) as {
            memberships?: Array<{ role: MemberRole }>;
            platformAdmin?: boolean;
          };
          memberships = payload.memberships ?? [];
          platformAdmin = Boolean(payload.platformAdmin);
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
      if (!memberships) {
        router.push("/app");
        router.refresh();
        return;
      }
      const destination =
        memberships.length === 0 && platformAdmin
          ? "/platform"
          : destinationAfterLogin({ memberships, next });
      if (destination === "/select-organization") {
        await fetch("/api/session", { method: "DELETE" });
      }
      router.push(destination as Route);
    } catch {
      router.push("/app");
    }
    router.refresh();
  }

  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      <section className="safe-top flex items-center justify-center bg-white px-5 py-10 sm:px-8">
        <div className="w-full max-w-md">
          {choosePassword ? (
            <ChoosePasswordStep onSaved={finishSignIn} />
          ) : sentTo ? (
            <AccessCodeStep
              email={sentTo}
              title={t("login.codeTitle")}
              description={
                inviteCode ? t("login.codeInvite") : t("login.codeOnce")
              }
              otpType={inviteCode ? "magiclink" : "email"}
              onVerified={() => setChoosePassword(true)}
              onResend={async () => {
                await sendCode(sentTo);
                setInviteCode(false);
              }}
              onBack={() => {
                setSentTo("");
                setInviteCode(false);
                setError("");
              }}
            />
          ) : (
            <>
              <div className="flex items-start justify-between gap-3">
                <Brand />
                <LanguageSwitcher compact />
              </div>

              <header className="mt-10">
                <p className="text-sm font-semibold text-[#0d9d99]">
                  {live ? t("login.welcomeBack") : t("login.demoMode")}
                </p>
                <h1 className="mt-2 text-[32px] font-semibold leading-tight tracking-[-.035em]">
                  {live ? t("login.accessSpace") : t("login.chooseProfile")}
                </h1>
                <p className="mt-3 text-[15px] leading-6 text-slate-500">
                  {live ? t("login.liveHint") : t("login.showcaseExplore")}
                </p>
              </header>

              {!live ? (
                <div className="mt-8 space-y-3">
                  {showcaseProfiles.map((profile) => (
                    <button
                      key={profile.role}
                      onClick={() => enterShowcase(profile.role)}
                      className="flex w-full items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 text-left transition active:scale-[.99] active:bg-slate-50"
                    >
                      <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-[#071426] text-white">
                        <profile.icon size={22} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-semibold">
                          {t(`roles.${profile.role}`)}
                        </span>
                        <span className="mt-0.5 block text-xs leading-5 text-slate-500">
                          {t(profile.descKey)}
                        </span>
                      </span>
                      <ArrowRight size={19} className="shrink-0 text-slate-300" />
                    </button>
                  ))}

                  <Callout tone="neutral" className="mt-5">
                    {t("login.showcaseCallout")}
                  </Callout>
                </div>
              ) : (
                <>
                  <form onSubmit={signIn} className="mt-8 space-y-4">
                    <Field label={t("login.email")}>
                      <input
                        required
                        autoFocus
                        type="email"
                        inputMode="email"
                        autoComplete="email"
                        className={fieldClass}
                        placeholder={t("login.emailPlaceholder")}
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                      />
                    </Field>
                    <Field label={t("login.password")}>
                      <input
                        required
                        type="password"
                        autoComplete="current-password"
                        className={fieldClass}
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                      />
                    </Field>

                    {error && (
                      <p
                        role="alert"
                        className="rounded-2xl bg-red-50 p-3.5 text-sm text-red-700"
                      >
                        {error}
                      </p>
                    )}

                    <Button
                      type="submit"
                      size="lg"
                      block
                      disabled={busy}
                      className="mt-2"
                    >
                      {busy ? (
                        <Loader2 size={19} className="animate-spin" />
                      ) : (
                        <>
                          {t("login.enter")}
                          <ArrowRight size={18} />
                        </>
                      )}
                    </Button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void requestCode()}
                      className="w-full text-center text-sm font-semibold text-blue-600"
                    >
                      {t("login.firstAccess")}
                    </button>
                  </form>

                  <p className="mt-6 text-center text-sm text-slate-500">
                    {t("login.noCompany")}{" "}
                    <Link href="/signup" className="font-semibold text-blue-600">
                      {t("login.createAccount")}
                    </Link>
                  </p>
                  <p className="mt-2 text-center text-xs leading-5 text-slate-400">
                    {t("login.companyKeyHint")}
                  </p>
                </>
              )}
            </>
          )}
        </div>
      </section>

      <section className="dark-panel relative hidden overflow-hidden p-12 text-white lg:flex lg:flex-col lg:justify-end">
        <div className="absolute -right-32 -top-32 size-[460px] rounded-full bg-[#10cfc9]/20 blur-3xl" />
        <div className="relative max-w-lg">
          <span className="grid size-14 place-items-center rounded-2xl bg-[#10cfc9] text-[#043b39]">
            <LockKeyhole size={26} />
          </span>
          <blockquote className="mt-8 text-[38px] font-medium leading-[1.12] tracking-[-.03em]">
            {t("login.quote")}
          </blockquote>
          <p className="mt-6 text-slate-400">{t("login.tagline")}</p>
        </div>
      </section>
    </main>
  );
}
