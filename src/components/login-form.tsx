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
import { Button, Callout, Field, fieldClass } from "./ui";
import { createClient } from "@/lib/supabase/client";
import { destinationAfterLogin, isLiveMode, roleHome } from "@/lib/config";
import { accessEmailSchema, signInSchema } from "@/lib/schemas";
import { SHOWCASE_ROLE_COOKIE } from "@/lib/session-constants";
import type { MemberRole } from "@/lib/domain";

const showcaseProfiles: Array<{
  role: Exclude<MemberRole, "superadmin">;
  label: string;
  description: string;
  icon: typeof Users;
}> = [
  {
    role: "admin",
    label: "Administración",
    description: "Operación completa, reportes y configuración",
    icon: Users,
  },
  {
    role: "host",
    label: "Anfitrión",
    description: "Invita visitantes y recibe avisos de llegada",
    icon: UserRound,
  },
  {
    role: "guard",
    label: "Guardia",
    description: "Escanea pases y controla entradas y salidas",
    icon: ShieldCheck,
  },
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
    params.get("error") === "invalid_link"
      ? "El enlace venció o ya se usó. Entra con tu contraseña o pide un código."
      : "",
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
      setError(parsed.error.issues[0]?.message ?? "Revisa los datos");
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
        throw new Error(
          "Correo o contraseña incorrectos. Si es tu primer acceso, pide un código.",
        );
      }
      await finishSignIn();
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "No pudimos entrar.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function requestCode() {
    const parsed = accessEmailSchema.safeParse(email.trim().toLowerCase());
    if (!parsed.success) {
      setError("Escribe un correo válido para enviarte el código");
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
          : "No pudimos enviar el código.",
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
      for (let attempt = 0; attempt < 3; attempt += 1) {
        const response = await fetch("/api/session", { cache: "no-store" });
        if (response.ok) {
          const payload = (await response.json()) as {
            memberships?: Array<{ role: MemberRole }>;
          };
          memberships = payload.memberships ?? [];
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
      if (!memberships) {
        router.push("/app");
        router.refresh();
        return;
      }
      const destination = destinationAfterLogin({ memberships, next });
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
              title="Escribe tu código"
              description={
                inviteCode
                  ? "Está en el correo de invitación. Confírmalo y después eliges tu contraseña."
                  : "Solo esta vez: confirma el correo y después eliges tu contraseña."
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
              <Brand />

              <header className="mt-10">
                <p className="text-sm font-semibold text-[#0d9d99]">
                  {live ? "Bienvenido de nuevo" : "Modo demostración"}
                </p>
                <h1 className="mt-2 text-[32px] font-semibold leading-tight tracking-[-.035em]">
                  {live ? "Accede a tu espacio" : "Elige un perfil"}
                </h1>
                <p className="mt-3 text-[15px] leading-6 text-slate-500">
                  {live
                    ? "Entra con tu correo y contraseña. El código solo se pide la primera vez."
                    : "Explora los tres portales sin credenciales. Los datos viven solo en este navegador."}
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
                          {profile.label}
                        </span>
                        <span className="mt-0.5 block text-xs leading-5 text-slate-500">
                          {profile.description}
                        </span>
                      </span>
                      <ArrowRight size={19} className="shrink-0 text-slate-300" />
                    </button>
                  ))}

                  <Callout tone="neutral" className="mt-5">
                    Al conectar Supabase, esta pantalla pasa automáticamente a
                    autenticación real.
                  </Callout>
                </div>
              ) : (
                <>
                  <form onSubmit={signIn} className="mt-8 space-y-4">
                    <Field label="Correo">
                      <input
                        required
                        autoFocus
                        type="email"
                        inputMode="email"
                        autoComplete="email"
                        className={fieldClass}
                        placeholder="tu@empresa.com"
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                      />
                    </Field>
                    <Field label="Contraseña">
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
                          Entrar
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
                      Es mi primer acceso o olvidé la contraseña
                    </button>
                  </form>

                  <p className="mt-6 text-center text-sm text-slate-500">
                    ¿Tu empresa aún no está aquí?{" "}
                    <Link href="/signup" className="font-semibold text-blue-600">
                      Crear cuenta
                    </Link>
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
            “Una recepción más ágil empieza antes de que llegue el visitante.”
          </blockquote>
          <p className="mt-6 text-slate-400">
            NEXA VISIT · Control inteligente de accesos
          </p>
        </div>
      </section>
    </main>
  );
}
