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
import { Button, Callout, Field, fieldClass } from "./ui";
import { createClient } from "@/lib/supabase/client";
import { isLiveMode, roleHome } from "@/lib/config";
import { accessEmailSchema } from "@/lib/schemas";
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
 * Acceso sin contraseñas: pedimos el correo, Supabase envía un código de un
 * solo uso y ese código abre la sesión. No hay nada que recordar ni recuperar.
 */
export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const live = isLiveMode();

  const [email, setEmail] = useState("");
  const [sentTo, setSentTo] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(
    params.get("error") === "invalid_link"
      ? "El enlace venció o ya se usó. Pide un código nuevo."
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

  async function requestCode(event: React.FormEvent) {
    event.preventDefault();
    const parsed = accessEmailSchema.safeParse(email.trim().toLowerCase());
    if (!parsed.success) {
      setError("Escribe un correo válido");
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

  function finishSignIn() {
    const next = params.get("next");
    const destination =
      next && next.startsWith("/") && !next.startsWith("//") ? next : "/app";
    router.push(destination as Route);
    router.refresh();
  }

  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      <section className="safe-top flex items-center justify-center bg-white px-5 py-10 sm:px-8">
        <div className="w-full max-w-md">
          {sentTo ? (
            <AccessCodeStep
              email={sentTo}
              title="Escribe tu código"
              description="Es un código de 6 dígitos y vence en una hora."
              onVerified={finishSignIn}
              onResend={() => sendCode(sentTo)}
              onBack={() => {
                setSentTo("");
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
                    ? "Te enviamos un código al correo. Sin contraseñas que recordar."
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
                    autenticación real con código por correo.
                  </Callout>
                </div>
              ) : (
                <>
                  <form onSubmit={requestCode} className="mt-8 space-y-4">
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
                          Enviarme un código
                          <ArrowRight size={18} />
                        </>
                      )}
                    </Button>
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
