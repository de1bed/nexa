"use client";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { manualVisitSchema } from "@/lib/schemas";
import { z } from "zod";
import { useDemo } from "./demo-provider";
import type { Visit } from "@/lib/domain";
import { Camera, CheckCircle2 } from "lucide-react";
type Form = z.infer<typeof manualVisitSchema>;
export function ManualAccess() {
  const { createVisit } = useDemo();
  const [done, setDone] = useState<Visit | null>(null);
  const [documentFile, setDocumentFile] = useState<File>();
  const [fileError, setFileError] = useState("");
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Form>({
    resolver: zodResolver(manualVisitSchema),
    defaultValues: {
      hostName: "Mateo García",
      purpose: "Reunión comercial",
      consent: false,
    },
  });
  const field =
    "h-12 w-full rounded-xl border border-white/15 bg-white/10 px-4 text-white outline-none focus:border-[#10cfc9]";
  async function submit(d: Form) {
    await new Promise((r) => setTimeout(r, 250));
    const now = new Date();
    const v: Visit = {
      id: crypto.randomUUID(),
      visitorName: d.visitorName,
      email: d.email,
      company: d.company,
      hostName: d.hostName,
      hostId: d.hostName.startsWith("Mateo") ? "host-mateo" : "host-valeria",
      location: "Centro de Distribución Tijuana",
      startsAt: now.toISOString(),
      endsAt: new Date(now.getTime() + 3600000).toISOString(),
      checkedInAt: now.toISOString(),
      purpose: d.purpose,
      status: "checked_in",
      origin: "guard_manual",
      documentCaptured: Boolean(documentFile),
      consentedAt: now.toISOString(),
    };
    const created = await createVisit({ ...v, documentFile });
    setDone(created);
  }
  if (done)
    return (
      <div className="py-14 text-center">
        <span className="mx-auto grid size-20 place-items-center rounded-full bg-emerald-500/15 text-emerald-300">
          <CheckCircle2 size={38} />
        </span>
        <h1 className="mt-6 text-3xl font-semibold">Entrada registrada</h1>
        <p className="mt-3 text-slate-400">
          {done.visitorName} está dentro · anfitrión {done.hostName}
        </p>
        <button
          onClick={() => setDone(null)}
          className="mt-8 h-13 w-full rounded-xl bg-white font-semibold text-[#071426]"
        >
          Registrar otra persona
        </button>
      </div>
    );
  return (
    <>
      <header className="mb-7">
        <p className="text-sm font-medium text-[#10cfc9]">
          Acceso sin preregistro
        </p>
        <h1 className="mt-2 text-3xl font-semibold">Registro manual</h1>
        <p className="mt-2 text-slate-400">
          Captura solo lo necesario. Meta: menos de un minuto.
        </p>
      </header>
      <form onSubmit={handleSubmit(submit)} className="space-y-4">
        <label className="block">
          <span className="mb-2 block text-sm">Nombre completo *</span>
          <input {...register("visitorName")} className={field} />
          {errors.visitorName && (
            <small className="text-red-300">{errors.visitorName.message}</small>
          )}
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label>
            <span className="mb-2 block text-sm">Correo</span>
            <input type="email" {...register("email")} className={field} />
          </label>
          <label>
            <span className="mb-2 block text-sm">Empresa *</span>
            <input {...register("company")} className={field} />
          </label>
        </div>
        <label className="block">
          <span className="mb-2 block text-sm">Anfitrión *</span>
          <select {...register("hostName")} className={field}>
            <option className="text-black">Mateo García</option>
            <option className="text-black">Valeria Cruz</option>
          </select>
        </label>
        <label className="block">
          <span className="mb-2 block text-sm">Motivo *</span>
          <select {...register("purpose")} className={field}>
            <option className="text-black">Reunión comercial</option>
            <option className="text-black">Entrega de proveedor</option>
            <option className="text-black">Entrevista</option>
            <option className="text-black">Soporte técnico</option>
          </select>
        </label>
        <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-white/15 bg-white/5 p-4">
          <Camera />
          <span className="flex-1 text-sm">
            Fotografía de identificación{" "}
            <small className="block text-slate-400">
              Opcional · almacenamiento privado
            </small>
          </span>
          <span className="text-right text-xs font-medium text-[#10cfc9]">
            {documentFile ? documentFile.name : "Tomar foto"}
          </span>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            capture="environment"
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0];
              setFileError("");
              if (!file) return setDocumentFile(undefined);
              if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 8388608) {
                setDocumentFile(undefined);
                setFileError("Usa JPG, PNG o WebP de máximo 8 MB.");
                return;
              }
              setDocumentFile(file);
            }}
          />
        </label>
        {fileError && <p role="alert" className="text-sm text-red-300">{fileError}</p>}
        <label className="flex items-start gap-3 rounded-xl border border-white/15 p-4">
          <input
            type="checkbox"
            {...register("consent")}
            className="mt-1 size-5 accent-[#10cfc9]"
          />
          <span className="text-sm leading-5">
            El visitante acepta el aviso de privacidad y el uso de sus datos
            para este acceso.
          </span>
        </label>
        {errors.consent && (
          <p className="text-sm text-red-300">Confirma el consentimiento.</p>
        )}
        <button
          disabled={isSubmitting}
          className="h-16 w-full rounded-2xl bg-[#10cfc9] text-lg font-semibold text-[#071426] disabled:opacity-50"
        >
          {isSubmitting ? "Registrando…" : "Registrar entrada ahora"}
        </button>
      </form>
    </>
  );
}
