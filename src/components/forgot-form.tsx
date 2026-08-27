"use client";
import { useState } from "react";
import Link from "next/link";
import { Brand } from "./brand";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import { createClient, hasSupabaseConfig } from "@/lib/supabase/client";
export function ForgotForm() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  return (
    <main className="min-h-screen bg-[#f7f9fc] px-5 py-10">
      <div className="mx-auto max-w-md">
        <Brand />
        <div className="mt-16 rounded-3xl border border-slate-200 bg-white p-7 shadow-sm">
          {sent ? (
            <div className="text-center">
              <CheckCircle2 className="mx-auto text-emerald-500" size={44} />
              <h1 className="mt-5 text-2xl font-semibold">Revisa tu correo</h1>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                Si existe una cuenta para {email}, recibirás instrucciones. Este
                mensaje no revela si el usuario existe.
              </p>
            </div>
          ) : (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (
                  process.env.NEXT_PUBLIC_DEMO_MODE === "false" &&
                  hasSupabaseConfig()
                ) {
                  await createClient().auth.resetPasswordForEmail(email, {
                    redirectTo: `${location.origin}/auth/callback?next=/update-password`,
                  });
                }
                setSent(true);
              }}
            >
              <h1 className="text-2xl font-semibold">Recuperar contraseña</h1>
              <p className="mt-2 text-sm text-slate-500">
                Te enviaremos un enlace temporal para crear una nueva.
              </p>
              <label className="mt-6 block text-sm">
                <span className="mb-2 block font-medium">Correo</span>
                <input
                  required
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-12 w-full rounded-xl border px-4 outline-none focus:border-[#10aaa5]"
                />
              </label>
              <button className="mt-5 h-12 w-full rounded-xl bg-[#071426] font-semibold text-white">
                Enviar enlace
              </button>
            </form>
          )}
          <Link
            href="/login"
            className="mt-6 flex items-center justify-center gap-2 text-sm text-slate-500"
          >
            <ArrowLeft size={16} />
            Volver al login
          </Link>
        </div>
      </div>
    </main>
  );
}
