"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowRight,
  Check,
  Eye,
  EyeOff,
  Loader2,
  MailCheck,
  ShieldCheck,
} from "lucide-react";
import { Brand } from "./brand";
import { Button, Callout, Field, cn, fieldClass } from "./ui";
import { createClient } from "@/lib/supabase/client";
import { isLiveMode, appUrl } from "@/lib/config";
import { signUpSchema } from "@/lib/schemas";

const benefits = [
  "Preregistro del visitante desde su teléfono",
  "Pases QR con validación en caseta",
  "Bitácora, aforo y reportes en tiempo real",
];

/** Alta de una empresa nueva: crea la cuenta y encadena con el onboarding. */
export function SignUpForm() {
  const router = useRouter();
  const live = isLiveMode();
  const [form, setForm] = useState({ fullName: "", email: "", password: "" });
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [needsConfirmation, setNeedsConfirmation] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const parsed = signUpSchema.safeParse(form);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Revisa los datos");
      return;
    }

    setBusy(true);
    setError("");
    try {
      const { data, error: authError } = await createClient().auth.signUp({
        email: form.email.trim(),
        password: form.password,
        options: {
          data: { full_name: form.fullName.trim() },
          emailRedirectTo: `${appUrl()}/auth/callback?next=/onboarding`,
        },
      });
      if (authError)
        throw new Error(
          authError.message.includes("already registered")
            ? "Ese correo ya tiene una cuenta. Inicia sesión."
            : "No fue posible crear la cuenta. Intenta de nuevo.",
        );

      // Con confirmación de correo activada no hay sesión todavía.
      if (!data.session) {
        setNeedsConfirmation(true);
        return;
      }
      router.push("/onboarding");
      router.refresh();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "No fue posible crear la cuenta.",
      );
    } finally {
      setBusy(false);
    }
  }

  if (needsConfirmation)
    return (
      <Shell>
        <div className="text-center">
          <span className="animate-pop mx-auto grid size-16 place-items-center rounded-full bg-emerald-50 text-emerald-600">
            <MailCheck size={30} />
          </span>
          <h1 className="mt-5 text-2xl font-semibold tracking-[-.02em]">
            Confirma tu correo
          </h1>
          <p className="mt-2.5 text-[15px] leading-6 text-slate-500">
            Enviamos un enlace a <b>{form.email}</b>. Ábrelo para activar tu
            cuenta y terminar de configurar tu empresa.
          </p>
          <Link href="/login" className="mt-7 inline-block">
            <Button variant="outline">Ir a iniciar sesión</Button>
          </Link>
        </div>
      </Shell>
    );

  return (
    <Shell>
      <Brand />
      <header className="mt-9">
        <p className="text-sm font-semibold text-[#0d9d99]">Crear cuenta</p>
        <h1 className="mt-2 text-[30px] font-semibold leading-tight tracking-[-.035em]">
          Registra tu empresa
        </h1>
        <p className="mt-3 text-[15px] leading-6 text-slate-500">
          En dos minutos tendrás tu recepción digital funcionando.
        </p>
      </header>

      {!live && (
        <Callout tone="warning" icon={ShieldCheck} className="mt-6">
          El registro de empresas requiere Supabase conectado. Mientras tanto,
          explora la plataforma desde{" "}
          <Link href="/login" className="font-semibold underline">
            el modo demostración
          </Link>
          .
        </Callout>
      )}

      <form onSubmit={submit} className="mt-7 space-y-4">
        <Field label="Tu nombre">
          <input
            required
            className={fieldClass}
            autoComplete="name"
            placeholder="Nombre y apellido"
            value={form.fullName}
            onChange={(event) =>
              setForm({ ...form, fullName: event.target.value })
            }
          />
        </Field>
        <Field label="Correo corporativo">
          <input
            required
            type="email"
            inputMode="email"
            autoComplete="email"
            className={fieldClass}
            placeholder="tu@empresa.com"
            value={form.email}
            onChange={(event) => setForm({ ...form, email: event.target.value })}
          />
        </Field>
        <Field label="Contraseña" hint="Mínimo 12 caracteres.">
          <div className="relative">
            <input
              required
              type={show ? "text" : "password"}
              autoComplete="new-password"
              className={cn(fieldClass, "pr-12")}
              value={form.password}
              onChange={(event) =>
                setForm({ ...form, password: event.target.value })
              }
            />
            <button
              type="button"
              aria-label={show ? "Ocultar contraseña" : "Mostrar contraseña"}
              onClick={() => setShow(!show)}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-slate-400"
            >
              {show ? <EyeOff size={19} /> : <Eye size={19} />}
            </button>
          </div>
        </Field>

        {error && (
          <p role="alert" className="rounded-2xl bg-red-50 p-3.5 text-sm text-red-700">
            {error}
          </p>
        )}

        <Button type="submit" size="lg" block disabled={busy || !live}>
          {busy ? (
            <Loader2 size={19} className="animate-spin" />
          ) : (
            <>
              Crear mi cuenta
              <ArrowRight size={18} />
            </>
          )}
        </Button>
      </form>

      <ul className="mt-7 space-y-2.5">
        {benefits.map((benefit) => (
          <li key={benefit} className="flex items-start gap-2.5 text-sm text-slate-600">
            <Check size={17} className="mt-0.5 shrink-0 text-[#0d9d99]" />
            {benefit}
          </li>
        ))}
      </ul>

      <p className="mt-7 text-center text-sm text-slate-500">
        ¿Ya tienes cuenta?{" "}
        <Link href="/login" className="font-semibold text-blue-600">
          Inicia sesión
        </Link>
      </p>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="safe-top min-h-screen bg-[#f4f7fb] px-5 py-10">
      <div className="mx-auto w-full max-w-md rounded-[26px] border border-slate-200 bg-white p-6 shadow-[0_1px_2px_rgba(7,20,38,.04),0_18px_48px_-30px_rgba(7,20,38,.4)] sm:p-8">
        {children}
      </div>
    </main>
  );
}
