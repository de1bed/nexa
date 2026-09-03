"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, MailCheck } from "lucide-react";
import { Brand } from "./brand";
import { Button, Callout, Field, fieldClass } from "./ui";
import { createClient } from "@/lib/supabase/client";
import { appUrl, isLiveMode } from "@/lib/config";

export function ForgotForm() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      if (isLiveMode())
        await createClient().auth.resetPasswordForEmail(email.trim(), {
          redirectTo: `${appUrl()}/auth/callback?next=/update-password`,
        });
    } catch {
      // El resultado no debe revelar si la cuenta existe.
    } finally {
      setBusy(false);
      setSent(true);
    }
  }

  return (
    <main className="safe-top min-h-screen bg-[#f4f7fb] px-5 py-10">
      <div className="mx-auto w-full max-w-md rounded-[26px] border border-slate-200 bg-white p-6 shadow-[0_1px_2px_rgba(7,20,38,.04),0_18px_48px_-30px_rgba(7,20,38,.4)] sm:p-8">
        <Brand href="#" />

        {sent ? (
          <div className="mt-8 text-center">
            <span className="animate-pop mx-auto grid size-16 place-items-center rounded-full bg-emerald-50 text-emerald-600">
              <MailCheck size={30} />
            </span>
            <h1 className="mt-5 text-2xl font-semibold tracking-[-.02em]">
              Revisa tu correo
            </h1>
            <p className="mt-2.5 text-[15px] leading-6 text-slate-500">
              Si existe una cuenta para {email}, recibirás instrucciones para
              crear una contraseña nueva.
            </p>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-8">
            <h1 className="text-[26px] font-semibold tracking-[-.03em]">
              Recuperar contraseña
            </h1>
            <p className="mt-2 text-[15px] text-slate-500">
              Te enviaremos un enlace temporal para crear una nueva.
            </p>

            <div className="mt-6">
              <Field label="Correo">
                <input
                  required
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  className={fieldClass}
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </Field>
            </div>

            {!isLiveMode() && (
              <Callout tone="neutral" className="mt-4">
                En modo demostración no hay cuentas reales: entra eligiendo un
                perfil en la pantalla de acceso.
              </Callout>
            )}

            <Button type="submit" size="lg" block className="mt-6" disabled={busy}>
              {busy ? (
                <Loader2 size={19} className="animate-spin" />
              ) : (
                "Enviar enlace"
              )}
            </Button>
          </form>
        )}

        <Link
          href="/login"
          className="mt-7 flex items-center justify-center gap-2 text-sm text-slate-500"
        >
          <ArrowLeft size={16} />
          Volver al inicio de sesión
        </Link>
      </div>
    </main>
  );
}
