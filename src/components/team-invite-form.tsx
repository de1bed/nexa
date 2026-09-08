"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Loader2, LockKeyhole } from "lucide-react";
import { Brand } from "./brand";
import { Button, Field, fieldClass } from "./ui";
import { createClient } from "@/lib/supabase/client";
import { roleHome } from "@/lib/config";
import { passwordSchema } from "@/lib/schemas";
import { roleLabels, type MemberRole } from "@/lib/domain";

type InvitePayload = {
  organization_name: string;
  inviter_name: string;
  invitee_name: string;
  invitee_email: string;
  role: MemberRole;
  state: "pending" | "expired" | "accepted" | "revoked";
};

export function TeamInviteForm({ token }: { token: string }) {
  const router = useRouter();
  const [invite, setInvite] = useState<InvitePayload | null>(null);
  const [loadError, setLoadError] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const response = await fetch(`/api/public/team-invites/${token}`, {
          cache: "no-store",
        });
        if (!response.ok) throw new Error("missing");
        const payload = (await response.json()) as InvitePayload;
        if (active) setInvite(payload);
      } catch {
        if (active) setLoadError("Este enlace no está disponible.");
      }
    })();
    return () => {
      active = false;
    };
  }, [token]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const parsed = passwordSchema.safeParse(password);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Contraseña inválida");
      return;
    }
    if (password !== confirm) {
      setError("Las contraseñas no coinciden");
      return;
    }

    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/public/team-invites/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: parsed.data }),
      });
      const payload = (await response.json()) as {
        error?: string;
        email?: string;
        role?: MemberRole;
      };
      if (!response.ok)
        throw new Error(payload.error ?? "No fue posible crear la cuenta");

      const { error: authError } = await createClient().auth.signInWithPassword({
        email: payload.email ?? invite?.invitee_email ?? "",
        password: parsed.data,
      });
      if (authError) throw new Error("La cuenta se creó. Entra desde inicio de sesión.");

      router.push(roleHome[payload.role ?? "host"]);
      router.refresh();
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "No fue posible crear la cuenta",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      <section className="safe-top flex items-center justify-center bg-white px-5 py-10 sm:px-8">
        <div className="w-full max-w-md">
          <Brand />

          {loadError ? (
            <>
              <h1 className="mt-10 text-[32px] font-semibold leading-tight tracking-[-.035em]">
                Enlace no disponible
              </h1>
              <p className="mt-3 text-[15px] leading-6 text-slate-500">
                {loadError} Pide a tu administrador que te envíe otra invitación.
              </p>
              <Link href="/login" className="mt-8 inline-block">
                <Button>Ir a iniciar sesión</Button>
              </Link>
            </>
          ) : !invite ? (
            <p className="mt-10 text-sm text-slate-500">Cargando invitación…</p>
          ) : invite.state !== "pending" ? (
            <>
              <h1 className="mt-10 text-[32px] font-semibold leading-tight tracking-[-.035em]">
                {invite.state === "accepted"
                  ? "Ya tienes cuenta"
                  : "Esta invitación ya no sirve"}
              </h1>
              <p className="mt-3 text-[15px] leading-6 text-slate-500">
                {invite.state === "accepted"
                  ? "Entra con el correo y la contraseña que elegiste."
                  : "Pide a tu administrador que te envíe un enlace nuevo."}
              </p>
              <Link href="/login" className="mt-8 inline-block">
                <Button>
                  Iniciar sesión
                  <ArrowRight size={18} />
                </Button>
              </Link>
            </>
          ) : (
            <>
              <header className="mt-10">
                <p className="text-sm font-semibold text-[#0d9d99]">
                  Invitación a {invite.organization_name}
                </p>
                <h1 className="mt-2 text-[32px] font-semibold leading-tight tracking-[-.035em]">
                  Crea tu cuenta
                </h1>
                <p className="mt-3 text-[15px] leading-6 text-slate-500">
                  <b className="text-[#071426]">{invite.inviter_name}</b> te
                  invitó a unirte a{" "}
                  <b className="text-[#071426]">{invite.organization_name}</b>{" "}
                  como {roleLabels[invite.role]}. Elige tu contraseña para
                  terminar.
                </p>
              </header>

              <form onSubmit={submit} className="mt-8 space-y-4">
                <Field label="Correo">
                  <input
                    readOnly
                    type="email"
                    autoComplete="username"
                    className={fieldClass}
                    value={invite.invitee_email}
                  />
                </Field>
                <Field label="Contraseña" hint="Mínimo 8 caracteres.">
                  <input
                    required
                    autoFocus
                    type="password"
                    autoComplete="new-password"
                    className={fieldClass}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                  />
                </Field>
                <Field label="Confírmala">
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

                <Button type="submit" size="lg" block disabled={busy} className="mt-2">
                  {busy ? (
                    <Loader2 size={19} className="animate-spin" />
                  ) : (
                    <>
                      Crear cuenta y unirme
                      <ArrowRight size={18} />
                    </>
                  )}
                </Button>
              </form>

              <p className="mt-6 text-center text-sm text-slate-500">
                ¿Ya tienes contraseña?{" "}
                <Link href="/login" className="font-semibold text-blue-600">
                  Inicia sesión
                </Link>
              </p>
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
            “Tu acceso empieza aquí. Una contraseña y ya formas parte del
            equipo.”
          </blockquote>
          <p className="mt-6 text-slate-400">
            NEXA VISIT · Control inteligente de accesos
          </p>
        </div>
      </section>
    </main>
  );
}
