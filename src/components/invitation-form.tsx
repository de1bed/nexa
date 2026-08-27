"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { invitationSchema } from "@/lib/schemas";
import { z } from "zod";
import { useDemo } from "./demo-provider";
import { randomToken } from "@/lib/security";
import {
  ArrowLeft,
  CalendarDays,
  Check,
  Copy,
  Mail,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import type { Visit } from "@/lib/domain";
type Form = z.infer<typeof invitationSchema>;
export function InvitationForm() {
  const { createVisit } = useDemo();
  const router = useRouter();
  const [created, setCreated] = useState<Visit | null>(null);
  const [copied, setCopied] = useState(false);
  const now = new Date();
  const defaultDate = new Date(now.getTime() + 86400000)
    .toISOString()
    .slice(0, 10);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Form>({
    resolver: zodResolver(invitationSchema),
    defaultValues: {
      location: "Centro de Distribución Tijuana",
      date: defaultDate,
      startTime: "10:00",
      endTime: "11:00",
      purpose: "Reunión comercial",
      sendEmail: true,
    },
  });
  const onSubmit = async (d: Form) => {
    await new Promise((r) => setTimeout(r, 350));
    const v: Visit = {
      id: crypto.randomUUID(),
      visitorName: d.visitorName,
      email: d.email,
      phone: d.phone,
      company: d.company,
      hostName: "Mateo García",
      hostId: "host-mateo",
      location: d.location,
      startsAt: new Date(`${d.date}T${d.startTime}`).toISOString(),
      endsAt: new Date(`${d.date}T${d.endTime}`).toISOString(),
      purpose: d.purpose,
      status: "invited",
      origin: "host_invitation",
      notes: d.notes,
      invitationToken: randomToken(24),
      documentCaptured: false,
    };
    const createdVisit = await createVisit({
      ...v,
      sendEmail: d.sendEmail,
      accessRequirements: d.accessRequirements,
    });
    setCreated(createdVisit);
  };
  if (created) {
    const url =
      typeof location !== "undefined"
        ? `${location.origin}/visit/${created.invitationToken}`
        : "";
    return (
      <div className="mx-auto max-w-2xl">
        <div className="rounded-3xl border border-emerald-200 bg-white p-8 text-center shadow-sm">
          <span className="mx-auto grid size-16 place-items-center rounded-full bg-emerald-50 text-emerald-600">
            <Check size={30} />
          </span>
          <h1 className="mt-5 text-2xl font-semibold">Invitación creada</h1>
          <p className="mt-2 text-slate-500">
            {created.visitorName} puede preparar su visita con este enlace
            seguro.
          </p>
          <div className="mt-6 flex rounded-xl border border-slate-200 bg-slate-50 p-2 pl-4">
            <input
              readOnly
              value={url}
              aria-label="Enlace de invitación"
              className="min-w-0 flex-1 bg-transparent text-sm outline-none"
            />
            <button
              onClick={async () => {
                await navigator.clipboard.writeText(url);
                setCopied(true);
              }}
              className="inline-flex items-center gap-2 rounded-lg bg-[#071426] px-4 py-2 text-sm font-medium text-white"
            >
              <Copy size={16} />
              {copied ? "Copiado" : "Copiar"}
            </button>
          </div>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <button
              onClick={() => router.push(`/app/visits/${created.id}`)}
              className="h-11 rounded-xl bg-[#071426] px-5 text-sm font-semibold text-white"
            >
              Ver visita
            </button>
            <button
              onClick={() => setCreated(null)}
              className="h-11 rounded-xl border border-slate-200 px-5 text-sm font-medium"
            >
              Crear otra
            </button>
          </div>
          <p className="mt-6 text-xs text-slate-400">
            <Mail className="mr-1 inline" size={13} />
            En modo desarrollo, el correo se registra en consola cuando Resend
            no está configurado.
          </p>
        </div>
      </div>
    );
  }
  const field =
    "h-11 w-full rounded-xl border border-slate-200 bg-white px-3 outline-none focus:border-[#10aaa5] focus:ring-2 focus:ring-[#10cfc9]/15";
  const label = "mb-2 block text-sm font-medium";
  return (
    <div className="mx-auto max-w-4xl">
      <Link
        href="/app/visits"
        className="mb-6 inline-flex items-center gap-2 text-sm text-slate-500"
      >
        <ArrowLeft size={16} />
        Volver
      </Link>
      <header className="mb-8">
        <p className="mb-2 text-sm font-medium text-[#0eaaa5]">Nueva visita</p>
        <h1 className="text-3xl font-semibold tracking-[-.03em]">
          Crear invitación
        </h1>
        <p className="mt-2 text-slate-500">
          El visitante recibirá un enlace privado para completar su preregistro.
        </p>
      </header>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-5 flex items-center gap-2 font-semibold">
            <UserRound size={18} />
            Visitante
          </h2>
          <div className="grid gap-5 sm:grid-cols-2">
            <label>
              <span className={label}>Nombre completo *</span>
              <input {...register("visitorName")} className={field} />
              {errors.visitorName && (
                <small className="text-red-600">
                  {errors.visitorName.message}
                </small>
              )}
            </label>
            <label>
              <span className={label}>Correo *</span>
              <input type="email" {...register("email")} className={field} />
              {errors.email && (
                <small className="text-red-600">{errors.email.message}</small>
              )}
            </label>
            <label>
              <span className={label}>Teléfono</span>
              <input {...register("phone")} className={field} />
            </label>
            <label>
              <span className={label}>Empresa *</span>
              <input {...register("company")} className={field} />
            </label>
          </div>
        </section>
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-5 flex items-center gap-2 font-semibold">
            <CalendarDays size={18} />
            Agenda
          </h2>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <label className="sm:col-span-2">
              <span className={label}>Ubicación *</span>
              <select {...register("location")} className={field}>
                <option>Centro de Distribución Tijuana</option>
              </select>
            </label>
            <label>
              <span className={label}>Fecha *</span>
              <input type="date" {...register("date")} className={field} />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label>
                <span className={label}>Inicio</span>
                <input
                  type="time"
                  {...register("startTime")}
                  className={field}
                />
              </label>
              <label>
                <span className={label}>Fin</span>
                <input type="time" {...register("endTime")} className={field} />
              </label>
            </div>
            <label className="sm:col-span-2">
              <span className={label}>Motivo *</span>
              <select {...register("purpose")} className={field}>
                <option>Reunión comercial</option>
                <option>Entrega de proveedor</option>
                <option>Entrevista</option>
                <option>Auditoría</option>
                <option>Soporte técnico</option>
              </select>
            </label>
            <label className="sm:col-span-2">
              <span className={label}>Requisitos de acceso</span>
              <input
                {...register("accessRequirements")}
                placeholder="Ej. traer calzado de seguridad"
                className={field}
              />
            </label>
            <label className="sm:col-span-4">
              <span className={label}>Notas internas</span>
              <textarea
                {...register("notes")}
                rows={3}
                className="w-full rounded-xl border border-slate-200 p-3 outline-none focus:border-[#10aaa5]"
              />
            </label>
          </div>
        </section>
        <div className="flex flex-col justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 sm:flex-row sm:items-center">
          <label className="flex items-center gap-3 text-sm">
            <input
              type="checkbox"
              {...register("sendEmail")}
              className="size-4 accent-[#10aaa5]"
            />
            Enviar invitación automáticamente
          </label>
          <button
            disabled={isSubmitting}
            className="h-12 rounded-xl bg-[#071426] px-7 font-semibold text-white disabled:opacity-60"
          >
            {isSubmitting ? "Creando…" : "Crear y enviar invitación"}
          </button>
        </div>
      </form>
    </div>
  );
}
