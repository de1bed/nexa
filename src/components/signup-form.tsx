"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Check, Loader2, ShieldCheck } from "lucide-react";
import { Brand } from "./brand";
import { AccessCodeStep, accessRequestError } from "./access-code";
import { ChoosePasswordStep } from "./choose-password";
import { Button, Callout, Field, fieldClass } from "./ui";
import { createClient } from "@/lib/supabase/client";
import { isLiveMode } from "@/lib/config";
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
  const [form, setForm] = useState({ fullName: "", email: "" });
  const [sentTo, setSentTo] = useState("");
  const [choosePassword, setChoosePassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function sendCode(address: string, fullName: string) {
    const { error: authError } = await createClient().auth.signInWithOtp({
      email: address,
      // El nombre viaja como metadato: el trigger de Supabase crea el perfil.
      options: { shouldCreateUser: true, data: { full_name: fullName } },
    });
    if (authError) throw new Error(accessRequestError(authError.message));
  }

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
      const address = parsed.data.email.toLowerCase();
      await sendCode(address, parsed.data.fullName);
      setSentTo(address);
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

  if (choosePassword)
    return (
      <Shell>
        <ChoosePasswordStep
          title="Crea tu contraseña"
          description="El código ya confirmó tu correo. De ahora en adelante entras con esta contraseña."
          onSaved={() => {
            router.push("/onboarding");
            router.refresh();
          }}
        />
      </Shell>
    );

  if (sentTo)
    return (
      <Shell>
        <AccessCodeStep
          email={sentTo}
          title="Confirma tu correo"
          description="Escribe el código de 6 dígitos. Solo se pide esta vez."
          onVerified={() => setChoosePassword(true)}
          onResend={() => sendCode(sentTo, form.fullName.trim())}
          onBack={() => {
            setSentTo("");
            setError("");
          }}
        />
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
          En dos minutos tendrás tu recepción digital funcionando. El código
          confirma tu correo una vez; después entras con tu contraseña.
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
