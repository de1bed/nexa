import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  FileScan,
  QrCode,
  ShieldCheck,
  Smartphone,
} from "lucide-react";
import { Brand } from "@/components/brand";
import { isLiveMode } from "@/lib/config";

export const metadata = { title: "Recorrido del visitante" };

const steps = [
  ["1", "Tus datos", "Solo lo necesario para identificarte en recepción."],
  ["2", "Identificación", "Foto con la cámara y lectura del texto en tu dispositivo."],
  ["3", "Consentimiento", "Conoces la finalidad y el plazo de retención antes de aceptar."],
  ["4", "Pase QR", "Un token aleatorio, sin datos personales dentro del código."],
];

/** Entrada demostrativa para conocer el flujo público sin una invitación real. */
export default function Page() {
  const live = isLiveMode();

  return (
    <main className="safe-top min-h-screen bg-[#f4f7fb] text-[#071426]">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
        <Brand />
        <Link
          href="/"
          className="text-sm font-medium text-slate-500 active:text-slate-900"
        >
          Volver al inicio
        </Link>
      </nav>

      <section className="mx-auto grid max-w-6xl gap-10 px-5 pb-16 pt-6 lg:grid-cols-[1fr_.85fr] lg:items-center lg:pt-14">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full bg-cyan-50 px-3.5 py-2 text-xs font-semibold text-[#0d9d99]">
            <Smartphone size={14} />
            Sin cuenta ni aplicación
          </span>

          <h1 className="mt-5 text-[34px] font-semibold leading-[1.1] tracking-[-.035em] sm:text-5xl">
            Prepara tu visita en dos minutos.
          </h1>
          <p className="mt-5 max-w-xl text-[17px] leading-8 text-slate-600">
            Así se ve el enlace privado que un anfitrión envía a su visitante.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/visit/nexa-demo-invitation-2026"
              className="inline-flex h-14 items-center justify-center gap-2 rounded-2xl bg-[#071426] px-6 font-semibold text-white transition active:scale-[.98]"
            >
              Probar el preregistro
              <ArrowRight size={19} />
            </Link>
            <Link
              href="/pass/nexa-demo-pass-2026"
              className="inline-flex h-14 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-6 font-semibold transition active:bg-slate-50"
            >
              <QrCode size={19} />
              Ver un pase
            </Link>
          </div>

          {live && (
            <p className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
              Esta plataforma ya opera contra su base de datos: los enlaces
              demostrativos de arriba solo funcionan en el modo de evaluación.
              Pide a tu anfitrión una invitación real.
            </p>
          )}

          <p className="mt-5 flex items-center gap-2 text-xs text-slate-500">
            <ShieldCheck size={15} className="text-[#0d9d99]" />
            Los documentos se guardan en almacenamiento privado y el QR no
            contiene datos personales.
          </p>
        </div>

        <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_20px_60px_-34px_rgba(7,20,38,.5)] sm:p-7">
          <div className="flex items-center justify-between border-b border-slate-100 pb-5">
            <div>
              <p className="text-[11px] font-semibold tracking-[.2em] text-slate-400">
                INVITACIÓN
              </p>
              <h2 className="mt-1 text-xl font-semibold">Nova Logistics</h2>
            </div>
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-bold text-emerald-700">
              ACTIVA
            </span>
          </div>

          <ol className="mt-6 space-y-4">
            {steps.map(([number, title, text]) => (
              <li key={number} className="flex gap-4">
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[#071426] text-sm font-semibold text-white">
                  {number}
                </span>
                <div>
                  <p className="font-semibold">{title}</p>
                  <p className="mt-1 text-sm leading-6 text-slate-500">{text}</p>
                </div>
              </li>
            ))}
          </ol>

          <div className="mt-6 flex items-center gap-3 rounded-2xl bg-blue-50 p-4 text-sm text-blue-900">
            <FileScan size={20} className="shrink-0" />
            <span>
              La lectura extrae texto: no verifica la autenticidad del documento.
            </span>
          </div>
        </div>
      </section>

      <section className="safe-bottom mx-auto max-w-6xl px-5 pb-16">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-900">
          <CheckCircle2 className="mr-2 inline" size={17} />
          <b>Demostración:</b> usa únicamente datos ficticios. El aviso de
          privacidad definitivo debe revisarse legalmente antes de producción.
        </div>
      </section>
    </main>
  );
}
