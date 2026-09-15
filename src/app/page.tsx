"use client";

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
import { LanguageSwitcher } from "@/components/language-switcher";
import { useI18n } from "@/components/i18n-provider";
import { isLiveMode } from "@/lib/config";

export default function Home() {
  const live = isLiveMode();
  const { t } = useI18n();

  const steps = [
    { icon: Share2, title: t("landing.step1Title"), text: t("landing.step1Text") },
    { icon: Smartphone, title: t("landing.step2Title"), text: t("landing.step2Text") },
    { icon: QrCode, title: t("landing.step3Title"), text: t("landing.step3Text") },
    { icon: ScanLine, title: t("landing.step4Title"), text: t("landing.step4Text") },
  ];

  const roles = [
    {
      icon: BarChart3,
      title: t("landing.roleAdmin"),
      points: [t("landing.roleAdmin1"), t("landing.roleAdmin2"), t("landing.roleAdmin3")],
    },
    {
      icon: CalendarClock,
      title: t("landing.roleHost"),
      points: [t("landing.roleHost1"), t("landing.roleHost2"), t("landing.roleHost3")],
    },
    {
      icon: ShieldCheck,
      title: t("landing.roleGuard"),
      points: [t("landing.roleGuard1"), t("landing.roleGuard2"), t("landing.roleGuard3")],
    },
    {
      icon: UserRoundCheck,
      title: t("landing.roleVisitor"),
      points: [
        t("landing.roleVisitor1"),
        t("landing.roleVisitor2"),
        t("landing.roleVisitor3"),
      ],
    },
  ];

  return (
    <main className="min-h-screen bg-[#071426] text-white">
      <nav className="safe-top mx-auto flex max-w-7xl items-center justify-between px-5 py-5 lg:px-10">
        <Brand dark />
        <div className="flex items-center gap-2">
          <LanguageSwitcher dark />
          <Link
            href="/login"
            className="rounded-full border border-white/15 px-4 py-2.5 text-sm font-medium transition active:bg-white/10"
          >
            {t("landing.enter")}
          </Link>
          {live && (
            <Link
              href="/signup"
              className="hidden rounded-full bg-[#10cfc9] px-4 py-2.5 text-sm font-semibold text-[#043b39] sm:block"
            >
              {t("landing.createAccount")}
            </Link>
          )}
        </div>
      </nav>

      <section className="relative mx-auto grid max-w-7xl gap-14 px-5 pb-20 pt-10 lg:grid-cols-[1.05fr_.95fr] lg:px-10 lg:pt-20">
        <div className="relative z-10">
          <span className="inline-flex items-center gap-2 rounded-full border border-[#10cfc9]/30 bg-[#10cfc9]/10 px-4 py-2 text-xs font-medium text-[#71f0eb]">
            <span className="size-1.5 rounded-full bg-[#10cfc9]" />
            {t("landing.badge")}
          </span>

          <h1 className="mt-6 text-[40px] font-semibold leading-[1.04] tracking-[-.04em] sm:text-6xl lg:text-7xl">
            {t("landing.heroLead")}{" "}
            <span className="text-[#10cfc9]">{t("landing.heroAccent")}</span>
          </h1>

          <p className="mt-6 max-w-xl text-[17px] leading-8 text-slate-300 sm:text-lg">
            {t("landing.heroBody")}
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href={live ? "/signup" : "/login"}
              className="inline-flex h-14 items-center justify-center gap-2 rounded-2xl bg-[#10cfc9] px-6 font-semibold text-[#043b39] shadow-[0_18px_45px_-16px_#10cfc9] transition active:scale-[.98]"
            >
              {live ? t("landing.ctaCompany") : t("landing.ctaDemo")}
              <ArrowRight size={19} />
            </Link>
            <Link
              href="/demo/visitor"
              className="inline-flex h-14 items-center justify-center rounded-2xl border border-white/15 px-6 font-medium transition active:bg-white/10"
            >
              {t("landing.visitorTour")}
            </Link>
          </div>

          <dl className="mt-12 grid max-w-xl grid-cols-3 gap-5 border-t border-white/10 pt-7">
            {[
              [t("landing.stat1v"), t("landing.stat1")],
              [t("landing.stat2v"), t("landing.stat2")],
              [t("landing.stat3v"), t("landing.stat3")],
            ].map(([value, label]) => (
              <div key={label}>
                <dt className="text-2xl font-semibold">{value}</dt>
                <dd className="mt-1 text-xs leading-5 text-slate-400">{label}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="relative flex items-center justify-center lg:justify-end">
          <div className="absolute inset-0 rounded-full bg-[#2563eb]/20 blur-3xl" />
          <div className="relative w-full max-w-sm rounded-[32px] border border-white/10 bg-white/[.07] p-3 shadow-2xl backdrop-blur-xl">
            <div className="rounded-[24px] bg-white p-5 text-[#071426]">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-semibold tracking-[.2em] text-slate-400">
                    {t("landing.passAccess")}
                  </p>
                  <p className="mt-1 font-semibold">Nova Logistics</p>
                </div>
                <span className="rounded-full bg-emerald-100 px-3 py-1 text-[11px] font-bold text-emerald-700">
                  {t("landing.valid")}
                </span>
              </div>

              <div className="my-5 grid place-items-center rounded-2xl bg-[#071426] p-6">
                <QrCode size={92} className="text-white" />
              </div>

              <p className="text-lg font-semibold">Sofía Rivera</p>
              <p className="mt-0.5 text-sm text-slate-500">
                {t("landing.visiting", { name: "Mateo García" })}
              </p>

              <div className="mt-4 space-y-2 border-t border-slate-100 pt-4 text-sm">
                <p className="flex items-center gap-2 text-slate-600">
                  <BadgeCheck size={16} className="text-emerald-500" />
                  {t("landing.identityOk")}
                </p>
                <p className="flex items-center gap-2 text-slate-600">
                  <Clock3 size={16} className="text-emerald-500" />
                  {t("landing.windowOk")}
                </p>
                <p className="flex items-center gap-2 text-slate-600">
                  <Building2 size={16} className="text-emerald-500" />
                  {t("landing.reception")}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-white/10 bg-[#061120]">
        <div className="mx-auto max-w-7xl px-5 py-16 lg:px-10 lg:py-24">
          <h2 className="max-w-2xl text-[30px] font-semibold leading-tight tracking-[-.03em] sm:text-4xl">
            {t("landing.howTitle")}
          </h2>
          <p className="mt-3 max-w-xl text-slate-400">{t("landing.howSub")}</p>

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
                <p className="mt-2 text-sm leading-6 text-slate-400">{step.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-16 lg:px-10 lg:py-24">
        <h2 className="max-w-2xl text-[30px] font-semibold leading-tight tracking-[-.03em] sm:text-4xl">
          {t("landing.rolesTitle")}
        </h2>
        <p className="mt-3 max-w-xl text-slate-400">{t("landing.rolesSub")}</p>

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

      <section className="mx-auto max-w-7xl px-5 pb-20 lg:px-10">
        <div className="rounded-[32px] border border-[#10cfc9]/20 bg-gradient-to-br from-[#10cfc9]/15 to-transparent p-8 text-center sm:p-14">
          <h2 className="text-[28px] font-semibold leading-tight tracking-[-.03em] sm:text-4xl">
            {t("landing.closeTitle")}
          </h2>
          <p className="mx-auto mt-3 max-w-lg text-slate-300">{t("landing.closeSub")}</p>
          <Link
            href={live ? "/signup" : "/login"}
            className="mt-8 inline-flex h-14 items-center justify-center gap-2 rounded-2xl bg-[#10cfc9] px-7 font-semibold text-[#043b39] transition active:scale-[.98]"
          >
            {live ? t("landing.closeLive") : t("landing.closeDemo")}
            <ArrowRight size={19} />
          </Link>
        </div>
      </section>

      <footer className="safe-bottom border-t border-white/10">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-5 py-8 text-sm text-slate-500 sm:flex-row lg:px-10">
          <Brand dark />
          <p>{t("landing.footer", { year: new Date().getFullYear() })}</p>
        </div>
      </footer>
    </main>
  );
}
