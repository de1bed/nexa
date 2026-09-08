"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Camera,
  Check,
  CheckCircle2,
  Loader2,
  ShieldCheck,
  UserPlus,
} from "lucide-react";
import { toast } from "sonner";
import { useWorkspace } from "./workspace-provider";
import { Button, Callout, Field, cn, fieldDarkClass } from "./ui";
import { manualVisitSchema } from "@/lib/schemas";
import { visitPurposes, type Visit } from "@/lib/domain";
import { compressIdentityImage, validateImage, ACCEPTED_IMAGE_TYPES } from "@/lib/image";

/**
 * Alta en caseta para quien llega sin invitación.
 * Anfitriones y ubicaciones salen del catálogo real de la organización.
 */
export function ManualAccess() {
  const { hosts, locations, createManualVisit, settings } = useWorkspace();
  const [done, setDone] = useState<Visit | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [form, setForm] = useState({
    visitorName: "",
    email: "",
    phone: "",
    company: "",
    hostId: "",
    locationId: "",
    purpose: visitPurposes[0] as string,
    consent: false,
  });

  const hostId = useMemo(
    () => form.hostId || hosts[0]?.id || "",
    [form.hostId, hosts],
  );
  const locationId = useMemo(
    () => form.locationId || locations[0]?.id || "",
    [form.locationId, locations],
  );

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => {
      if (!current[key as string]) return current;
      const next = { ...current };
      delete next[key as string];
      return next;
    });
  }

  async function attach(file: File) {
    const invalid = validateImage(file);
    if (invalid) {
      toast.error(invalid);
      return;
    }
    const compressed = await compressIdentityImage(file).catch(() => null);
    if (!compressed) {
      toast.error("No pudimos leer esa foto. Tómala de nuevo o usa JPG.");
      return;
    }
    setDocumentFile(compressed);
    toast.success("Identificación adjuntada");
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const payload = { ...form, hostId, locationId };
    const parsed = manualVisitSchema.safeParse(payload);

    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      parsed.error.issues.forEach((issue) => {
        const key = String(issue.path[0] ?? "form");
        fieldErrors[key] ??= issue.message;
      });
      setErrors(fieldErrors);
      toast.error("Revisa los datos capturados");
      return;
    }

    setSubmitting(true);
    try {
      const visit = await createManualVisit({
        visitorName: payload.visitorName,
        email: payload.email,
        phone: payload.phone ?? "",
        company: payload.company,
        hostId,
        locationId,
        purpose: payload.purpose,
        documentFile: documentFile ?? undefined,
      });
      setDone(visit);
      if (typeof navigator !== "undefined" && "vibrate" in navigator)
        navigator.vibrate(60);
    } catch (reason) {
      toast.error(
        reason instanceof Error
          ? reason.message
          : "No fue posible registrar el acceso",
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (done)
    return (
      <div className="animate-rise py-14 text-center">
        <span className="animate-pop mx-auto grid size-24 place-items-center rounded-full bg-emerald-500/15 text-emerald-300">
          <CheckCircle2 size={44} />
        </span>
        <h1 className="mt-7 text-3xl font-semibold tracking-[-.02em]">
          Entrada registrada
        </h1>
        <p className="mt-3 text-slate-400">
          {done.visitorName} está dentro · anfitrión {done.hostName}
        </p>
        <div className="mt-10 space-y-3">
          <Button
            size="lg"
            block
            className="bg-white text-[#071426]"
            onClick={() => {
              setDone(null);
              setDocumentFile(null);
              setForm((current) => ({
                ...current,
                visitorName: "",
                email: "",
                phone: "",
                company: "",
                consent: false,
              }));
            }}
          >
            <UserPlus size={19} />
            Registrar a otra persona
          </Button>
          <Link href="/guard/inside" className="block">
            <Button variant="light" size="lg" block>
              Ver quién está dentro
            </Button>
          </Link>
        </div>
      </div>
    );

  const missingCatalog = hosts.length === 0 || locations.length === 0;

  return (
    <div className="animate-rise">
      <header className="mb-6">
        <p className="text-[13px] font-semibold text-[#10cfc9]">
          Acceso sin preregistro
        </p>
        <h1 className="mt-1.5 text-[30px] font-semibold tracking-[-.03em]">
          Registro manual
        </h1>
        <p className="mt-1.5 text-[15px] text-slate-400">
          Captura lo indispensable. Menos de un minuto.
        </p>
      </header>

      {missingCatalog && (
        <Callout tone="warning" className="mb-5">
          Falta configurar anfitriones o ubicaciones en la organización. Pide a
          administración que los dé de alta.
        </Callout>
      )}

      <form onSubmit={submit} className="space-y-4">
        <Field label="Nombre completo" dark error={errors.visitorName}>
          <input
            className={fieldDarkClass}
            autoComplete="off"
            placeholder="Como aparece en su identificación"
            value={form.visitorName}
            onChange={(event) => update("visitorName", event.target.value)}
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Empresa" dark error={errors.company}>
            <input
              className={fieldDarkClass}
              placeholder="A quién representa"
              value={form.company}
              onChange={(event) => update("company", event.target.value)}
            />
          </Field>
          <Field label="Teléfono" dark optional>
            <input
              type="tel"
              inputMode="tel"
              className={fieldDarkClass}
              value={form.phone}
              onChange={(event) => update("phone", event.target.value)}
            />
          </Field>
        </div>

        <Field label="Correo" dark optional error={errors.email}>
          <input
            type="email"
            inputMode="email"
            className={fieldDarkClass}
            value={form.email}
            onChange={(event) => update("email", event.target.value)}
          />
        </Field>

        <Field label="Anfitrión" dark error={errors.hostId}>
          <select
            className={fieldDarkClass}
            value={hostId}
            onChange={(event) => update("hostId", event.target.value)}
          >
            {hosts.map((host) => (
              <option key={host.id} value={host.id} className="text-black">
                {host.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Ubicación" dark error={errors.locationId}>
          <select
            className={fieldDarkClass}
            value={locationId}
            onChange={(event) => update("locationId", event.target.value)}
          >
            {locations.map((location) => (
              <option key={location.id} value={location.id} className="text-black">
                {location.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Motivo" dark error={errors.purpose}>
          <select
            className={fieldDarkClass}
            value={form.purpose}
            onChange={(event) => update("purpose", event.target.value)}
          >
            {visitPurposes.map((purpose) => (
              <option key={purpose} className="text-black">
                {purpose}
              </option>
            ))}
          </select>
        </Field>

        <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-white/15 bg-white/[.06] p-4">
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-white/10">
            <Camera size={20} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold">
              Foto de identificación
            </span>
            <span className="mt-0.5 block text-xs text-slate-400">
              Opcional · almacenamiento privado ·{" "}
              {settings.documentRetentionDays} días de retención
            </span>
          </span>
          <span className="shrink-0 text-right text-xs font-semibold text-[#10cfc9]">
            {documentFile ? "Adjuntada" : "Tomar foto"}
          </span>
          <input
            type="file"
            accept={ACCEPTED_IMAGE_TYPES.join(",")}
            capture="environment"
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void attach(file);
              event.target.value = "";
            }}
          />
        </label>

        <button
          type="button"
          onClick={() => update("consent", !form.consent)}
          className={cn(
            "flex w-full items-start gap-3 rounded-2xl border p-4 text-left transition",
            form.consent
              ? "border-[#10cfc9] bg-[#10cfc9]/10"
              : "border-white/15 bg-white/[.04]",
          )}
        >
          <span
            className={cn(
              "mt-0.5 grid size-6 shrink-0 place-items-center rounded-lg border-2 transition",
              form.consent
                ? "border-[#10cfc9] bg-[#10cfc9] text-[#043b39]"
                : "border-white/30",
            )}
          >
            {form.consent && <Check size={15} strokeWidth={3} />}
          </span>
          <span className="text-sm leading-6">
            El visitante fue informado del aviso de privacidad y acepta el uso de
            sus datos para este acceso.
          </span>
        </button>
        {errors.consent && (
          <p className="text-sm font-medium text-red-300">{errors.consent}</p>
        )}

        <Button
          type="submit"
          variant="accent"
          size="lg"
          block
          disabled={submitting || missingCatalog}
          className="h-16 text-lg"
        >
          {submitting ? (
            <Loader2 size={20} className="animate-spin" />
          ) : (
            <ShieldCheck size={20} />
          )}
          {submitting ? "Registrando…" : "Registrar entrada ahora"}
        </Button>
      </form>
    </div>
  );
}
