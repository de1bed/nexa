"use client";
import { useState } from "react";
import Link from "next/link";
import { Brand } from "./brand";
import { CheckCircle2 } from "lucide-react";
import { createClient, hasSupabaseConfig } from "@/lib/supabase/client";

export function UpdatePasswordForm() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    if (password.length < 12) return setError("Usa al menos 12 caracteres.");
    if (password !== confirm) return setError("Las contraseñas no coinciden.");
    if (process.env.NEXT_PUBLIC_DEMO_MODE === "false" && hasSupabaseConfig()) {
      const { error: authError } = await createClient().auth.updateUser({
        password,
      });
      if (authError)
        return setError("El enlace venció o no es válido. Solicita uno nuevo.");
    }
    setDone(true);
  }
  return (
    <main className="min-h-screen bg-[#f7f9fc] px-5 py-10">
      <div className="mx-auto max-w-md">
        <Brand />
        <div className="mt-16 rounded-3xl border border-slate-200 bg-white p-7 shadow-sm">
          {done ? (
            <div className="text-center">
              <CheckCircle2 className="mx-auto text-emerald-500" size={44} />
              <h1 className="mt-5 text-2xl font-semibold">
                Contraseña actualizada
              </h1>
              <Link
                href="/login"
                className="mt-6 inline-flex h-11 items-center rounded-xl bg-[#071426] px-5 text-sm font-semibold text-white"
              >
                Iniciar sesión
              </Link>
            </div>
          ) : (
            <form onSubmit={submit}>
              <h1 className="text-2xl font-semibold">Nueva contraseña</h1>
              <p className="mt-2 text-sm text-slate-500">
                Elige una contraseña única de al menos 12 caracteres.
              </p>
              <label className="mt-6 block text-sm">
                <span className="mb-2 block font-medium">Contraseña</span>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-12 w-full rounded-xl border px-4 outline-none focus:border-[#10aaa5]"
                />
              </label>
              <label className="mt-4 block text-sm">
                <span className="mb-2 block font-medium">Confirmar</span>
                <input
                  type="password"
                  required
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className="h-12 w-full rounded-xl border px-4 outline-none focus:border-[#10aaa5]"
                />
              </label>
              {error && (
                <p
                  role="alert"
                  className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700"
                >
                  {error}
                </p>
              )}
              <button className="mt-5 h-12 w-full rounded-xl bg-[#071426] font-semibold text-white">
                Guardar contraseña
              </button>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
