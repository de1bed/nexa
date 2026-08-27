"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Brand } from "./brand";
import { ArrowRight, Eye, EyeOff, LoaderCircle, LockKeyhole, ShieldCheck, UserRound, Users } from "lucide-react";
import { createClient, hasSupabaseConfig } from "@/lib/supabase/client";
import type { MemberRole } from "@/lib/domain";

const demoAccounts: Array<{ role: Exclude<MemberRole, "superadmin">; label: string; email: string; description: string; icon: typeof Users }> = [
  { role: "admin", label: "Administración", email: "admin@novalogistics.demo", description: "Operación y configuración", icon: Users },
  { role: "host", label: "Anfitrión", email: "mateo@novalogistics.demo", description: "Mis visitas e invitaciones", icon: UserRound },
  { role: "guard", label: "Guardia", email: "guardia1@novalogistics.demo", description: "Entradas y salidas", icon: ShieldCheck },
];

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState(demoAccounts[0].email);
  const [password, setPassword] = useState("NexaDemo2026!");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const demo = process.env.NEXT_PUBLIC_DEMO_MODE !== "false";

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      let role: Exclude<MemberRole, "superadmin"> = email.startsWith("guardia") ? "guard" : email.startsWith("mateo") || email.startsWith("valeria") ? "host" : "admin";
      if (hasSupabaseConfig() && !demo) {
        const { error: authError } = await createClient().auth.signInWithPassword({ email, password });
        if (authError) throw authError;
      } else {
        const account = demoAccounts.find((item) => item.email === email);
        if (!account || password !== "NexaDemo2026!") throw new Error("Credenciales demo inválidas");
        role = account.role;
        document.cookie = `nexa-demo-role=${role}; path=/; max-age=86400; samesite=lax`;
      }
      await new Promise((resolve) => setTimeout(resolve, 250));
      router.push((role === "guard" ? "/guard/scan" : role === "host" ? "/app/host" : "/app/dashboard") as never);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No pudimos iniciar sesión. Revisa tus datos e intenta de nuevo.");
    } finally {
      setBusy(false);
    }
  }

  return <main className="grid min-h-screen bg-white lg:grid-cols-2">
    <section className="flex items-center justify-center px-6 py-10"><div className="w-full max-w-md"><Brand/><div className="mt-10"><p className="text-sm font-medium text-[#0eaaa5]">Bienvenido de nuevo</p><h1 className="mt-2 text-4xl font-semibold tracking-[-.04em]">Accede a tu espacio</h1><p className="mt-3 text-slate-500">Cada perfil abre una experiencia diseñada para su trabajo.</p></div>
      {demo && <div className="mt-7 grid gap-2 sm:grid-cols-3">{demoAccounts.map((account) => <button key={account.role} type="button" onClick={() => {setEmail(account.email);setPassword("NexaDemo2026!");}} className={`rounded-xl border p-3 text-left transition ${email === account.email ? "border-[#10aaa5] bg-cyan-50 ring-2 ring-[#10cfc9]/15" : "border-slate-200 hover:bg-slate-50"}`}><account.icon size={18} className="mb-2"/><span className="block text-sm font-semibold">{account.label}</span><span className="mt-1 block text-[11px] leading-4 text-slate-500">{account.description}</span></button>)}</div>}
      <form onSubmit={submit} className="mt-7 space-y-5"><label className="block"><span className="mb-2 block text-sm font-medium">Correo</span><input value={email} onChange={(event) => setEmail(event.target.value)} type="email" required className="h-12 w-full rounded-xl border border-slate-200 px-4 outline-none focus:border-[#10aaa5]"/></label><label className="block"><span className="mb-2 flex justify-between text-sm font-medium">Contraseña <Link href="/forgot-password" className="font-normal text-blue-600">¿La olvidaste?</Link></span><span className="relative block"><input value={password} onChange={(event) => setPassword(event.target.value)} type={show ? "text" : "password"} required className="h-12 w-full rounded-xl border border-slate-200 px-4 pr-12 outline-none focus:border-[#10aaa5]"/><button type="button" aria-label="Mostrar contraseña" onClick={() => setShow(!show)} className="absolute right-3 top-3 text-slate-400">{show ? <EyeOff/> : <Eye/>}</button></span></label>{error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}<button disabled={busy} className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#071426] font-semibold text-white disabled:opacity-60">{busy ? <LoaderCircle className="animate-spin"/> : <>Entrar como {demoAccounts.find((item) => item.email === email)?.label ?? "usuario"} <ArrowRight size={18}/></>}</button></form>
      {demo && <p className="mt-4 text-center text-xs text-slate-500">Contraseña para todos los perfiles: <b>NexaDemo2026!</b></p>}
    </div></section>
    <section className="relative hidden overflow-hidden bg-[#071426] p-12 text-white lg:flex lg:flex-col lg:justify-end"><div className="absolute -right-40 -top-40 size-[500px] rounded-full bg-[#10cfc9]/20 blur-3xl"/><div className="relative max-w-lg"><span className="grid size-14 place-items-center rounded-2xl bg-[#10cfc9] text-[#071426]"><LockKeyhole/></span><blockquote className="mt-8 text-4xl font-medium leading-tight tracking-[-.03em]">“Una recepción más ágil empieza antes de que llegue el visitante.”</blockquote><p className="mt-6 text-slate-400">NEXA VISIT · Control inteligente de accesos</p></div></section>
  </main>;
}
