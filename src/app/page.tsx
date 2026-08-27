import Link from "next/link";
import { ArrowRight, CheckCircle2, QrCode, ShieldCheck } from "lucide-react";

const stats = [["18", "Visitas programadas"], ["7", "Personas dentro"], ["4 min", "Registro promedio"]];

export default function Home() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#071426] text-white">
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-6 py-6 lg:px-10">
        <div className="flex items-center gap-3"><span className="grid size-9 place-items-center rounded-xl bg-[#10cfc9] text-[#071426]"><ShieldCheck size={20} /></span><span className="text-sm font-semibold tracking-[.18em]">NEXA VISIT</span></div>
        <Link className="rounded-full border border-white/15 px-5 py-2.5 text-sm font-medium transition hover:bg-white/10" href="/login">Iniciar sesión</Link>
      </nav>
      <section className="relative mx-auto grid max-w-7xl gap-16 px-6 pb-24 pt-16 lg:grid-cols-[1.05fr_.95fr] lg:px-10 lg:pt-24">
        <div className="relative z-10">
          <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-[#10cfc9]/30 bg-[#10cfc9]/10 px-4 py-2 text-xs font-medium text-[#71f0eb]"><span className="size-1.5 rounded-full bg-[#10cfc9]" /> Accesos simples. Operación segura.</div>
          <h1 className="max-w-3xl text-5xl font-semibold leading-[1.02] tracking-[-.045em] sm:text-6xl lg:text-7xl">Cada visita, bajo control. <span className="text-[#10cfc9]">Sin fricción.</span></h1>
          <p className="mt-7 max-w-xl text-lg leading-8 text-slate-300">Preregistro, identificación, pases QR y control de acceso en una experiencia moderna para visitantes, anfitriones y seguridad.</p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Link className="inline-flex h-13 items-center justify-center gap-2 rounded-xl bg-[#10cfc9] px-6 font-semibold text-[#071426] shadow-[0_14px_45px_-15px_#10cfc9] transition hover:-translate-y-0.5" href="/login">Elegir portal demo <ArrowRight size={18} /></Link>
            <Link className="inline-flex h-13 items-center justify-center rounded-xl border border-white/15 px-6 font-medium transition hover:bg-white/10" href={"/demo/visitor" as never}>Soy visitante</Link>
          </div>
          <div className="mt-12 grid max-w-xl grid-cols-3 gap-5 border-t border-white/10 pt-7">{stats.map(([value, label]) => <div key={label}><p className="text-2xl font-semibold">{value}</p><p className="mt-1 text-xs leading-5 text-slate-400">{label}</p></div>)}</div>
        </div>
        <div className="relative flex items-center justify-center lg:justify-end">
          <div className="absolute inset-0 rounded-full bg-[#2563eb]/20 blur-3xl" />
          <div className="relative w-full max-w-lg rounded-[2rem] border border-white/10 bg-white/[.07] p-4 shadow-2xl backdrop-blur-xl">
            <div className="rounded-[1.4rem] bg-[#f7f9fc] p-5 text-[#071426] sm:p-7">
              <div className="flex items-center justify-between"><div><p className="text-xs font-medium text-slate-500">PASE DE VISITANTE</p><p className="mt-1 font-semibold">Nova Logistics</p></div><span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">LISTO</span></div>
              <div className="my-7 grid grid-cols-[1fr_auto] items-center gap-5 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
                <div><p className="text-xl font-semibold">Sofía Rivera</p><p className="mt-1 text-sm text-slate-500">Visita a Mateo García</p><div className="mt-5 space-y-2 text-sm"><p className="flex items-center gap-2"><CheckCircle2 size={16} className="text-emerald-500" /> Identidad registrada</p><p className="flex items-center gap-2"><CheckCircle2 size={16} className="text-emerald-500" /> Ventana válida · 10:00–11:30</p></div></div>
                <div className="grid size-24 place-items-center rounded-xl bg-[#071426] text-white"><QrCode size={62} /></div>
              </div>
              <div className="flex items-center justify-between text-sm"><span className="text-slate-500">Jueves, 27 de agosto</span><span className="font-medium">Recepción Norte</span></div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
