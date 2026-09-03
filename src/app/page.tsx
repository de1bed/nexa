import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  BarChart3,
  Building2,
  CalendarClock,
  Check,
  Clock3,
  QrCode,
  ScanLine,
  Share2,
  ShieldCheck,
  Smartphone,
  UserRoundCheck,
} from "lucide-react";
import { Brand } from "@/components/brand";
import { isLiveMode } from "@/lib/config";

const steps = [
  {
    icon: Share2,
    title: "El anfitrión comparte un enlace",
    text: "Elige día, hora y sede. Nada más. El enlace se manda por WhatsApp o correo.",
  },
  {
    icon: Smartphone,
    title: "El visitante se registra solo",
    text: "Desde su teléfono: datos, foto de su identificación y consentimiento.",
  },
  {
    icon: QrCode,
    title: "Recibe su pase QR",
    text: "Un token aleatorio, sin datos personales dentro del código.",
  },
  {
    icon: ScanLine,
    title: "El guardia valida y cronometra",
    text: "Escanea, autoriza y arranca el conteo de tiempo dentro. Salida con un toque.",
  },
];

const roles = [
  {
    icon: BarChart3,
    title: "Administración",
    points: ["Aforo en vivo", "Reportes y CSV", "Retención y privacidad"],
  },
  {
    icon: CalendarClock,
    title: "Anfitrión",
    points: ["Invita en 30 segundos", "Aviso cuando llega", "Solo ve sus visitas"],
  },
  {
    icon: ShieldCheck,
    title: "Guardia",
    points: ["Escáner a pantalla completa", "Alta manual sin pase", "Bitácora del turno"],
  },
  {
    icon: UserRoundCheck,
    title: "Visitante",
    points: ["Sin cuenta ni app", "Dos minutos de registro", "Entra sin filas"],
  },
];

export default function Home() {
  const live = isLiveMode();

  return (
    <main className="min-h-screen bg-[#071426] text-white">
      <nav className="safe-top mx-auto flex max-w-7xl items-center justify-between px-5 py-5 lg:px-10">
        <Brand dark />
        <div className="flex items-center gap-2">
          <Link
            href="/login"
            className="rounded-full border border-white/15 px-4 py-2.5 text-sm font-medium transition active:bg-white/10"
          >
            Entrar
          </Link>
          {live && (
            <Link
              href="/signup"
              className="hidden rounded-full bg-[#10cfc9] px-4 py-2.5 text-sm font-semibold text-[#043b39] sm:block"
            >
              Crear cuenta
            </Link>
          )}
        </div>
      </nav>

      {/* Hero */}
      <section className="relative mx-auto grid max-w-7xl gap-14 px-5 pb-20 pt-10 lg:grid-cols-[1.05fr_.95fr] lg:px-10 lg:pt-20">
        <div className="relative z-10">
          <span className="inline-flex items-center gap-2 rounded-full border border-[#10cfc9]/30 bg-[#10cfc9]/10 px-4 py-2 text-xs font-medium text-[#71f0eb]">
            <span className="size-1.5 rounded-full bg-[#10cfc9]" />
            Accesos simples. Operación segura.
          </span>

          <h1 className="mt-6 text-[40px] font-semibold leading-[1.04] tracking-[-.04em] sm:text-6xl lg:text-7xl">
            Cada visita, bajo control.{" "}
            <span className="text-[#10cfc9]">Sin fricción.</span>
          </h1>

          <p className="mt-6 max-w-xl text-[17px] leading-8 text-slate-300 sm:text-lg">
            Tu anfitrión comparte un enlace. El visitante llega registrado, con
            su pase QR listo. Tu equipo deja de capturar datos en papel.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href={live ? "/signup" : "/login"}
              className="inline-flex h-14 items-center justify-center gap-2 rounded-2xl bg-[#10cfc9] px-6 font-semibold text-[#043b39] shadow-[0_18px_45px_-16px_#10cfc9] transition active:scale-[.98]"
            >
              {live ? "Registrar mi empresa" : "Elegir portal demo"}
              <ArrowRight size={19} />
            </Link>
            <Link
              href="/demo/visitor"
              className="inline-flex h-14 items-center justify-center rounded-2xl border border-white/15 px-6 font-medium transition active:bg-white/10"
            >
              Ver el recorrido del visitante
            </Link>
          </div>

          <dl className="mt-12 grid max-w-xl grid-cols-3 gap-5 border-t border-white/10 pt-7">
            {[
              ["2 min", "Registro del visitante"],
              ["1 toque", "Validación en caseta"],
              ["En vivo", "Aforo y tiempos"],
            ].map(([value, label]) => (
              <div key={label}>
                <dt className="text-2xl font-semibold">{value}</dt>
                <dd className="mt-1 text-xs leading-5 text-slate-400">{label}</dd>
              </div>
            ))}
          </dl>
        </div>

        {/* Maqueta del pase */}
        <div className="relative flex items-center justify-center lg:justify-end">
          <div className="absolute inset-0 rounded-full bg-[#2563eb]/20 blur-3xl" />
          <div className="relative w-full max-w-sm rounded-[32px] border border-white/10 bg-white/[.07] p-3 shadow-2xl backdrop-blur-xl">
            <div className="rounded-[24px] bg-white p-5 text-[#071426]">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-semibold tracking-[.2em] text-slate-400">
                    PASE DE ACCESO
                  </p>
                  <p className="mt-1 font-semibold">Nova Logistics</p>
                </div>
                <span className="rounded-full bg-emerald-100 px-3 py-1 text-[11px] font-bold text-emerald-700">
                  VÁLIDO
                </span>
              </div>

              <div className="my-5 grid place-items-center rounded-2xl bg-[#071426] p-6">
                <QrCode size={92} className="text-white" />
              </div>

              <p className="text-lg font-semibold">Sofía Rivera</p>
              <p className="mt-0.5 text-sm text-slate-500">
                Visita a Mateo García
              </p>

              <div className="mt-4 space-y-2 border-t border-slate-100 pt-4 text-sm">
                <p className="flex items-center gap-2 text-slate-600">
                  <BadgeCheck size={16} className="text-emerald-500" />
                  Identidad registrada
                </p>
                <p className="flex items-center gap-2 text-slate-600">
                  <Clock3 size={16} className="text-emerald-500" />
                  Ventana válida · 10:00–11:30
                </p>
                <p className="flex items-center gap-2 text-slate-600">
                  <Building2 size={16} className="text-emerald-500" />
                  Recepción Norte
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Cómo funciona */}
      <section className="border-t border-white/10 bg-[#061120]">
        <div className="mx-auto max-w-7xl px-5 py-16 lg:px-10 lg:py-24">
          <h2 className="max-w-2xl text-[30px] font-semibold leading-tight tracking-[-.03em] sm:text-4xl">
            Cuatro pasos, cero papel
          </h2>
          <p className="mt-3 max-w-xl text-slate-400">
            El trabajo se mueve al visitante, que ya trae el teléfono en la mano.
          </p>

          <ol className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map((step, index) => (
              <li
                key={step.title}
                className="rounded-3xl border border-white/10 bg-white/[.04] p-6"
              >
                <div className="flex items-center justify-between">
                  <span className="grid size-11 place-items-center rounded-2xl bg-[#10cfc9]/15 text-[#10cfc9]">
                    <step.icon size={21} />
                  </span>
                  <span className="text-3xl font-semibold text-white/10">
                    {index + 1}
                  </span>
                </div>
                <h3 className="mt-5 font-semibold leading-snug">{step.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-400">
                  {step.text}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Roles */}
      <section className="mx-auto max-w-7xl px-5 py-16 lg:px-10 lg:py-24">
        <h2 className="max-w-2xl text-[30px] font-semibold leading-tight tracking-[-.03em] sm:text-4xl">
          Una plataforma, cuatro experiencias
        </h2>
        <p className="mt-3 max-w-xl text-slate-400">
          Cada quien ve exactamente lo que necesita, y nada más.
        </p>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {roles.map((role) => (
            <article
              key={role.title}
              className="rounded-3xl border border-white/10 bg-white/[.04] p-6"
            >
              <span className="grid size-11 place-items-center rounded-2xl bg-white/10 text-[#10cfc9]">
                <role.icon size={21} />
              </span>
              <h3 className="mt-5 font-semibold">{role.title}</h3>
              <ul className="mt-3 space-y-2">
                {role.points.map((point) => (
                  <li
                    key={point}
                    className="flex items-start gap-2 text-sm leading-6 text-slate-400"
                  >
                    <Check size={15} className="mt-1 shrink-0 text-[#10cfc9]" />
                    {point}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>

      {/* Cierre */}
      <section className="mx-auto max-w-7xl px-5 pb-20 lg:px-10">
        <div className="rounded-[32px] border border-[#10cfc9]/20 bg-gradient-to-br from-[#10cfc9]/15 to-transparent p-8 text-center sm:p-14">
          <h2 className="text-[28px] font-semibold leading-tight tracking-[-.03em] sm:text-4xl">
            Tu recepción digital, lista hoy
          </h2>
          <p className="mx-auto mt-3 max-w-lg text-slate-300">
            Da de alta tu empresa, invita a tu equipo y empieza a recibir
            visitantes con pase QR.
          </p>
          <Link
            href={live ? "/signup" : "/login"}
            className="mt-8 inline-flex h-14 items-center justify-center gap-2 rounded-2xl bg-[#10cfc9] px-7 font-semibold text-[#043b39] transition active:scale-[.98]"
          >
            {live ? "Crear mi cuenta" : "Entrar a la demostración"}
            <ArrowRight size={19} />
          </Link>
        </div>
      </section>

      <footer className="safe-bottom border-t border-white/10">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-5 py-8 text-sm text-slate-500 sm:flex-row lg:px-10">
          <Brand dark />
          <p>Control inteligente de visitantes · {new Date().getFullYear()}</p>
        </div>
      </footer>
    </main>
  );
}
