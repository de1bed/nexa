import Link from "next/link";
import { ArrowRight, CheckCircle2, FileScan, QrCode, ShieldCheck, Smartphone } from "lucide-react";
import { Brand } from "@/components/brand";

const steps = [
  ["1", "Datos personales", "Completa únicamente la información necesaria."],
  ["2", "Identificación y OCR", "Captura, revisa y corrige el texto extraído."],
  ["3", "Consentimiento", "Conoce la finalidad y la retención antes de aceptar."],
  ["4", "Pase QR", "Recibe un token sin datos personales en texto plano."],
];

export default function Page() {
  return <main className="min-h-screen bg-[#f7f9fc] text-[#071426]">
    <nav className="mx-auto flex max-w-6xl items-center justify-between px-5 py-6"><Brand/><Link href="/" className="text-sm font-medium text-slate-500 hover:text-slate-900">Volver al inicio</Link></nav>
    <section className="mx-auto grid max-w-6xl gap-10 px-5 pb-16 pt-8 lg:grid-cols-[1fr_.85fr] lg:items-center lg:pt-16">
      <div><span className="inline-flex items-center gap-2 rounded-full bg-cyan-50 px-3 py-1.5 text-xs font-semibold text-[#0eaaa5]"><Smartphone size={14}/> Experiencia sin cuenta ni aplicación</span><h1 className="mt-5 text-4xl font-semibold tracking-[-.04em] sm:text-5xl">Prepara tu visita en pocos minutos.</h1><p className="mt-5 max-w-xl text-lg leading-8 text-slate-600">Este acceso demostrativo representa el enlace privado que un anfitrión envía a su visitante.</p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row"><Link href="/visit/nexa-demo-invitation-2026" className="inline-flex h-13 items-center justify-center gap-2 rounded-xl bg-[#071426] px-6 font-semibold text-white">Completar preregistro demo <ArrowRight size={18}/></Link><Link href="/pass/nexa-demo-pass-2026" className="inline-flex h-13 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-6 font-semibold"><QrCode size={18}/> Ver pase de ejemplo</Link></div>
        <p className="mt-4 flex items-center gap-2 text-xs text-slate-500"><ShieldCheck size={15}/> Los documentos se mantienen privados y el QR no contiene datos personales.</p>
      </div>
      <div className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-xl shadow-slate-200/60 sm:p-7"><div className="flex items-center justify-between border-b border-slate-100 pb-5"><div><p className="text-xs font-semibold tracking-widest text-slate-400">INVITACIÓN DEMO</p><h2 className="mt-1 text-xl font-semibold">Nova Logistics</h2></div><span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">ACTIVA</span></div><div className="mt-6 space-y-4">{steps.map(([number,title,text]) => <div key={number} className="flex gap-4"><span className="grid size-9 shrink-0 place-items-center rounded-full bg-[#071426] text-sm font-semibold text-white">{number}</span><div><p className="font-semibold">{title}</p><p className="mt-1 text-sm leading-6 text-slate-500">{text}</p></div></div>)}</div><div className="mt-6 flex items-center gap-3 rounded-xl bg-blue-50 p-4 text-sm text-blue-800"><FileScan size={20}/><span>El OCR extrae texto; no autentica la identificación.</span></div></div>
    </section>
    <section className="mx-auto max-w-6xl px-5 pb-16"><div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-900"><CheckCircle2 className="mr-2 inline" size={17}/><b>Demostración segura:</b> utiliza únicamente datos ficticios. El aviso definitivo debe revisarse legalmente antes de producción.</div></section>
  </main>;
}
