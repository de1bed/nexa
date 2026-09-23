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
import { clearDemoSession } from "@/lib/demo-public";
import { signUpSchema } from "@/lib/schemas";

const benefits = [
  "Preregistro del visitante desde su teléfono",
  "Pases QR con validación en caseta",
  "Bitácora, aforo y reportes en tiempo real",
];

/** Crea la cuenta personal. La clave de empresa se pide en el siguiente paso. */
export function SignUpForm() {
  const router = useRouter();
  const live = isLiveMode();
  const [form, setForm] = useState({ fullName: "", email: "" });
  const [companyKey, setCompanyKey] = useState("");
  const [organizationName, setOrganizationName] = useState("");
  const [sentTo, setSentTo] = useState("");
  const [choosePassword, setChoosePassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function sendCode(address: string, fullName: string) {
    const client = createClient();
    // Si había otra sesión en este navegador, no heredar su empresa.
    await client.auth.signOut();
    const { error: authError } = await client.auth.signInWithOtp({
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
      if (!organizationName) {
        setError("Primero escribe la clave de tu empresa.");
        return;
      }
      clearDemoSession();
      const existing = await fetch("/api/auth/account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: address }),
      });
      const account = (await existing.json()) as { exists?: boolean };
      if (account.exists) {
        setError("Esta cuenta ya existe. Inicia sesión.");
        return;
      }
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
            clearDemoSession();
            if (companyKey) sessionStorage.setItem("nexa-signup-key", companyKey);
            router.push("/solicitar");
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
        <p className="text-sm font-semibold text-[#0d9d99]">Clave de empresa</p>
        <h1 className="mt-2 text-[30px] font-semibold leading-tight tracking-[-.035em]">
          Regístrate con la clave
        </h1>
        <p className="mt-3 text-[15px] leading-6 text-slate-500">
          La empresa la da de alta NEXA. Tú entras con la clave que te
          compartieron, o con la invitación de tu administrador. Sin eso no se
          abre una cuenta.
        </p>
      </header>

      {!live && (
        <Callout tone="warning" icon={ShieldCheck} className="mt-6">
          El registro requiere la plataforma conectada. Mientras tanto, explora
          desde{" "}
          <Link href="/demo" className="font-semibold underline">
            la demostración
          </Link>
          .
        </Callout>
      )}

      {!organizationName ? (
        <form
          className="mt-7 space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            setBusy(true);
            setError("");
            void fetch("/api/public/access-key", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ key: companyKey }),
            })
              .then(async (response) => {
                const payload = (await response.json()) as {
                  organizationName?: string;
                  error?: string;
                };
                if (!response.ok || !payload.organizationName) {
                  throw new Error(payload.error ?? "Clave inválida");
                }
                setOrganizationName(payload.organizationName);
              })
              .catch((reason) => {
                setError(reason instanceof Error ? reason.message : "Clave inválida");
              })
              .finally(() => setBusy(false));
          }}
        >
          <Field label="Clave de tu empresa">
            <input
              required
              className={fieldClass}
              autoComplete="off"
              placeholder="NEXA-XXXX-XXXX"
              value={companyKey}
              onChange={(event) => setCompanyKey(event.target.value)}
            />
          </Field>
          {error && (
            <p role="alert" className="rounded-2xl bg-red-50 p-3.5 text-sm text-red-700">
              {error}
            </p>
          )}
          <Button type="submit" size="lg" block disabled={busy || !live}>
            {busy ? <Loader2 size={19} className="animate-spin" /> : "Continuar"}
          </Button>
        </form>
      ) : (
      <form onSubmit={submit} className="mt-7 space-y-4">
        <p className="text-sm text-slate-500">
          Empresa: <b className="text-[#071426]">{organizationName}</b>
        </p>
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
      )}

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
