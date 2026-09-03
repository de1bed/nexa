"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2 } from "lucide-react";
import { Brand } from "./brand";
import { Button, Field, ProgressBar, fieldClass } from "./ui";
import { createClient } from "@/lib/supabase/client";
import { isLiveMode } from "@/lib/config";

/** Fuerza de la contraseña: longitud y variedad de caracteres. */
function strength(value: string) {
  let score = 0;
  if (value.length >= 12) score += 40;
  if (value.length >= 16) score += 15;
  if (/[a-z]/.test(value) && /[A-Z]/.test(value)) score += 20;
  if (/\d/.test(value)) score += 15;
  if (/[^A-Za-z0-9\s]/.test(value)) score += 10;
  return Math.min(100, score);
}

export function UpdatePasswordForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    if (password.length < 12) {
      setError("Usa al menos 12 caracteres.");
      return;
    }
    if (password !== confirm) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    setBusy(true);
    try {
      if (isLiveMode()) {
        const { error: authError } = await createClient().auth.updateUser({
          password,
        });
        if (authError) throw authError;
      }
      setDone(true);
      setTimeout(() => {
        router.push("/app");
        router.refresh();
      }, 1400);
    } catch {
      setError("El enlace venció o no es válido. Solicita uno nuevo.");
    } finally {
      setBusy(false);
    }
  }

  const score = strength(password);

  return (
    <main className="safe-top min-h-screen bg-[#f4f7fb] px-5 py-10">
      <div className="mx-auto w-full max-w-md rounded-[26px] border border-slate-200 bg-white p-6 shadow-[0_1px_2px_rgba(7,20,38,.04),0_18px_48px_-30px_rgba(7,20,38,.4)] sm:p-8">
        <Brand href="#" />

        {done ? (
          <div className="mt-8 text-center">
            <span className="animate-pop mx-auto grid size-16 place-items-center rounded-full bg-emerald-50 text-emerald-600">
              <CheckCircle2 size={32} />
            </span>
            <h1 className="mt-5 text-2xl font-semibold tracking-[-.02em]">
              Contraseña actualizada
            </h1>
            <p className="mt-2 text-[15px] text-slate-500">
              Entrando a tu espacio de trabajo…
            </p>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-8 space-y-4">
            <div>
              <h1 className="text-[26px] font-semibold tracking-[-.03em]">
                Crea tu contraseña
              </h1>
              <p className="mt-2 text-[15px] text-slate-500">
                Mínimo 12 caracteres. Combina mayúsculas, números y símbolos.
              </p>
            </div>

            <Field label="Nueva contraseña">
              <input
                required
                type="password"
                autoComplete="new-password"
                className={fieldClass}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </Field>

            {password && (
              <div>
                <ProgressBar value={score} />
                <p className="mt-1.5 text-xs text-slate-500">
                  {score < 50 ? "Débil" : score < 80 ? "Aceptable" : "Fuerte"}
                </p>
              </div>
            )}

            <Field label="Repite la contraseña">
              <input
                required
                type="password"
                autoComplete="new-password"
                className={fieldClass}
                value={confirm}
                onChange={(event) => setConfirm(event.target.value)}
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

            <Button type="submit" size="lg" block disabled={busy}>
              {busy ? (
                <Loader2 size={19} className="animate-spin" />
              ) : (
                "Guardar contraseña"
              )}
            </Button>
          </form>
        )}

        <Link href="/login" className="mt-7 block text-center text-sm text-slate-500">
          Volver al inicio de sesión
        </Link>
      </div>
    </main>
  );
}
