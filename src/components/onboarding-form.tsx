"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Building2,
  Check,
  Loader2,
  MapPin,
  Sparkles,
} from "lucide-react";
import { Brand } from "./brand";
import { AddressField } from "./address-field";
import { Button, Field, cn, fieldClass } from "./ui";
import { onboardingSchema } from "@/lib/schemas";

const steps = [
  { title: "Tu empresa", icon: Building2 },
  { title: "Tu recepción", icon: MapPin },
];

const timezones = [
  "America/Mexico_City",
  "America/Tijuana",
  "America/Monterrey",
  "America/Cancun",
  "America/Bogota",
  "America/Lima",
  "America/Santiago",
  "America/Buenos_Aires",
  "Europe/Madrid",
];

/**
 * Alta de la organización. Al terminar, la empresa queda operativa: tiene
 * administración, configuración de privacidad y su primera ubicación.
 */
export function OnboardingForm({ defaultName }: { defaultName: string }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    organizationName: "",
    fullName: defaultName,
    locationName: "Recepción principal",
    locationAddress: "",
    timezone: "America/Mexico_City",
  });

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setError("");
  }

  async function submit() {
    const parsed = onboardingSchema.safeParse(form);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Revisa los datos");
      return;
    }

    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok)
        throw new Error(payload.error ?? "No fue posible crear la organización");
      router.push("/app/dashboard");
      router.refresh();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "No fue posible crear la organización",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="safe-top min-h-screen bg-[#f4f7fb] px-5 py-10">
      <div className="mx-auto w-full max-w-lg">
        <Brand href="#" />

        <div className="mt-8 flex items-center gap-3">
          {steps.map((item, index) => (
            <div key={item.title} className="flex flex-1 items-center gap-3">
              <span
                className={cn(
                  "grid size-9 shrink-0 place-items-center rounded-full text-sm font-semibold transition",
                  index < step
                    ? "bg-[#10cfc9] text-[#043b39]"
                    : index === step
                      ? "bg-[#071426] text-white"
                      : "bg-slate-200 text-slate-500",
                )}
              >
                {index < step ? <Check size={17} strokeWidth={3} /> : index + 1}
              </span>
              <span
                className={cn(
                  "hidden text-sm font-medium sm:block",
                  index === step ? "text-[#071426]" : "text-slate-400",
                )}
              >
                {item.title}
              </span>
              {index < steps.length - 1 && (
                <span className="h-px flex-1 bg-slate-200" />
              )}
            </div>
          ))}
        </div>

        <div className="animate-rise mt-6 rounded-[26px] border border-slate-200 bg-white p-6 shadow-[0_1px_2px_rgba(7,20,38,.04),0_18px_48px_-30px_rgba(7,20,38,.4)] sm:p-8">
          {step === 0 ? (
            <>
              <span className="grid size-14 place-items-center rounded-2xl bg-[#10cfc9]/15 text-[#0d9d99]">
                <Sparkles size={26} />
              </span>
              <h1 className="mt-5 text-[26px] font-semibold leading-tight tracking-[-.03em]">
                Configura tu empresa
              </h1>
              <p className="mt-2.5 text-[15px] leading-6 text-slate-500">
                Con esto queda lista tu recepción digital. En el panel verás
                Equipo: ahí invitas anfitriones y guardias.
              </p>

              <div className="mt-7 space-y-4">
                <Field label="Nombre de la empresa">
                  <input
                    autoFocus
                    className={fieldClass}
                    placeholder="Nova Logistics"
                    value={form.organizationName}
                    onChange={(event) =>
                      update("organizationName", event.target.value)
                    }
                  />
                </Field>
                <Field
                  label="Tu nombre"
                  hint="Aparecerá como anfitrión en las invitaciones que crees."
                >
                  <input
                    className={fieldClass}
                    value={form.fullName}
                    onChange={(event) => update("fullName", event.target.value)}
                  />
                </Field>
              </div>

              {error && (
                <p className="mt-4 rounded-2xl bg-red-50 p-3.5 text-sm text-red-700">
                  {error}
                </p>
              )}

              <Button
                variant="accent"
                size="lg"
                block
                className="mt-7"
                onClick={() => {
                  if (form.organizationName.trim().length < 2)
                    return setError("Escribe el nombre de tu empresa");
                  if (form.fullName.trim().length < 2)
                    return setError("Escribe tu nombre");
                  setStep(1);
                }}
              >
                Continuar
                <ArrowRight size={18} />
              </Button>
            </>
          ) : (
            <>
              <span className="grid size-14 place-items-center rounded-2xl bg-blue-50 text-blue-600">
                <MapPin size={26} />
              </span>
              <h1 className="mt-5 text-[26px] font-semibold leading-tight tracking-[-.03em]">
                ¿Dónde recibes visitantes?
              </h1>
              <p className="mt-2.5 text-[15px] leading-6 text-slate-500">
                Puedes agregar más sedes después desde Ubicaciones.
              </p>

              <div className="mt-7 space-y-4">
                <Field label="Nombre de la recepción">
                  <input
                    className={fieldClass}
                    placeholder="Recepción principal"
                    value={form.locationName}
                    onChange={(event) =>
                      update("locationName", event.target.value)
                    }
                  />
                </Field>
                <AddressField
                  value={form.locationAddress}
                  onChange={(value) => update("locationAddress", value)}
                />
                <Field label="Zona horaria">
                  <select
                    className={fieldClass}
                    value={form.timezone}
                    onChange={(event) => update("timezone", event.target.value)}
                  >
                    {timezones.map((zone) => (
                      <option key={zone}>{zone}</option>
                    ))}
                  </select>
                </Field>
              </div>

              {error && (
                <p className="mt-4 rounded-2xl bg-red-50 p-3.5 text-sm text-red-700">
                  {error}
                </p>
              )}

              <div className="mt-7 flex gap-3">
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => setStep(0)}
                  disabled={busy}
                >
                  Atrás
                </Button>
                <Button
                  variant="accent"
                  size="lg"
                  className="flex-1"
                  disabled={busy}
                  onClick={submit}
                >
                  {busy ? (
                    <Loader2 size={19} className="animate-spin" />
                  ) : (
                    <>
                      Activar mi empresa
                      <ArrowRight size={18} />
                    </>
                  )}
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
