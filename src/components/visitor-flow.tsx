/* eslint-disable @next/next/no-img-element */
"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import QRCode from "qrcode";
import { useDemo } from "./demo-provider";
import { Brand } from "./brand";
import { MockOCRProvider } from "@/lib/ocr/mock";
import type { OCRResult } from "@/lib/ocr/types";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Camera,
  Check,
  Download,
  FileImage,
  LoaderCircle,
  LockKeyhole,
  ShieldCheck,
} from "lucide-react";
import { randomToken } from "@/lib/security";
import { compressIdentityImage } from "@/lib/image";
import { hasSupabaseConfig } from "@/lib/supabase/client";
import type { Visit } from "@/lib/domain";
type Step =
  | "welcome"
  | "personal"
  | "identity"
  | "review"
  | "details"
  | "consent"
  | "done";
const steps: Step[] = [
  "welcome",
  "personal",
  "identity",
  "review",
  "details",
  "consent",
  "done",
];
export function VisitorFlow({ token }: { token: string }) {
  const { state, updateVisit } = useDemo();
  const production =
    process.env.NEXT_PUBLIC_DEMO_MODE === "false" && hasSupabaseConfig();
  const localVisit = state.visits.find((v) => v.invitationToken === token);
  const [remoteVisit, setRemoteVisit] = useState<Visit | null>(null);
  const [publicLoading, setPublicLoading] = useState(production);
  const [publicState, setPublicState] = useState<string>();
  const visit = localVisit ?? remoteVisit;
  const [step, setStep] = useState<Step>(
    visit?.status === "invited"
      ? "welcome"
      : visit?.qrToken
        ? "done"
        : "welcome",
  );
  const [data, setData] = useState({
    fullName: visit?.visitorName ?? "",
    email: visit?.email ?? "",
    phone: visit?.phone ?? "",
    company: visit?.company ?? "",
    documentType: "INE",
    documentNumber: "",
    vehiclePlate: "",
    visitorNotes: "",
  });
  const [file, setFile] = useState<File | null>(null);
  const [ocr, setOcr] = useState<OCRResult | null>(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [consent, setConsent] = useState(false);
  const [qr, setQr] = useState("");
  useEffect(() => {
    if (!production) return;
    fetch(`/api/public/invitations/${encodeURIComponent(token)}`, {
      cache: "no-store",
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("invalid");
        return response.json() as Promise<{
          visit_id: string;
          location_name: string;
          host_name: string;
          visitor_name: string;
          visitor_email: string;
          starts_at: string;
          ends_at: string;
          purpose: string;
          state: string;
        }>;
      })
      .then((result) => {
        setPublicState(result.state);
        setRemoteVisit({
          id: result.visit_id,
          visitorName: result.visitor_name,
          email: result.visitor_email,
          company: "",
          hostName: result.host_name,
          hostId: "",
          location: result.location_name,
          startsAt: result.starts_at,
          endsAt: result.ends_at,
          purpose: result.purpose,
          status:
            result.state === "cancelled"
              ? "cancelled"
              : result.state === "expired"
                ? "expired"
                : result.state === "completed"
                  ? "pre_registered"
                  : "invited",
          origin: "host_invitation",
          invitationToken: token,
          documentCaptured: result.state === "completed",
        });
        setData((current) => ({
          ...current,
          fullName: result.visitor_name || current.fullName,
          email: result.visitor_email || current.email,
        }));
      })
      .catch(() => setPublicState("invalid"))
      .finally(() => setPublicLoading(false));
  }, [production, token]);
  const index = steps.indexOf(step);
  const next = (s: Step) => {
    setError("");
    setStep(s);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  useEffect(() => {
    if (visit && (step === "done" || visit.qrToken)) {
      QRCode.toDataURL(visit.qrToken ?? token, {
        width: 360,
        margin: 2,
        color: { dark: "#071426", light: "#ffffff" },
      }).then(setQr);
    }
  }, [step, visit, token]);
  const date = useMemo(
    () =>
      visit
        ? new Intl.DateTimeFormat("es-MX", {
            dateStyle: "full",
            timeStyle: "short",
          }).format(new Date(visit.startsAt))
        : "",
    [visit],
  );
  if (publicLoading)
    return (
      <PublicFrame>
        <div className="py-16 text-center">
          <LoaderCircle
            className="mx-auto animate-spin text-[#10aaa5]"
            size={38}
          />
          <p className="mt-4 text-sm text-slate-500">Validando invitación…</p>
        </div>
      </PublicFrame>
    );
  if (!visit)
    return (
      <PublicFrame>
        <StateCard
          icon={<AlertTriangle />}
          title="Enlace no disponible"
          text="El enlace es inválido, venció o fue revocado. Solicita una nueva invitación a tu anfitrión."
        />
      </PublicFrame>
    );
  if (visit.status === "cancelled")
    return (
      <PublicFrame>
        <StateCard
          icon={<AlertTriangle />}
          title="Visita cancelada"
          text="Esta invitación fue cancelada. Contacta a tu anfitrión si necesitas reagendar."
        />
      </PublicFrame>
    );
  if (publicState === "expired" || visit.status === "expired")
    return (
      <PublicFrame>
        <StateCard
          icon={<AlertTriangle />}
          title="Enlace vencido"
          text="La ventana de esta invitación terminó. Solicita una nueva a tu anfitrión."
        />
      </PublicFrame>
    );
  if (production && publicState === "completed" && step !== "done")
    return (
      <PublicFrame>
        <StateCard
          icon={<Check />}
          title="Preregistro completado"
          text="Este enlace ya fue utilizado. Abre el enlace de tu pase enviado por correo para mostrar tu QR."
        />
      </PublicFrame>
    );
  const activeVisit = visit;
  async function processFile(f: File) {
    setError("");
    if (!["image/jpeg", "image/png", "image/webp"].includes(f.type)) {
      setError("Usa una imagen JPG, PNG o WebP.");
      return;
    }
    if (f.size > 8 * 1024 * 1024) {
      setError("El documento supera el límite de 8 MB.");
      return;
    }
    const compressed = await compressIdentityImage(f).catch(() => f);
    setFile(compressed);
    setProgress(18);
    next("identity");
    const timer = setInterval(
      () => setProgress((p) => Math.min(88, p + 12)),
      120,
    );
    try {
      const result = await new MockOCRProvider().extractIdentityData(
        compressed,
      );
      clearInterval(timer);
      setProgress(100);
      setOcr(result);
      setData((d) => ({
        ...d,
        fullName: result.fullName || d.fullName,
        documentNumber: result.documentNumber || d.documentNumber,
      }));
      setTimeout(() => next("review"), 300);
    } catch {
      clearInterval(timer);
      setError(
        "No pudimos leer la imagen. Puedes reintentar o capturar los datos manualmente.",
      );
    }
  }
  async function finish() {
    if (!consent) {
      setError("Debes aceptar el aviso de privacidad para continuar.");
      return;
    }
    if (production) {
      if (!file) {
        setError("Debes capturar tu identificación antes de continuar.");
        return;
      }
      const form = new FormData();
      Object.entries({
        fullName: data.fullName,
        email: data.email,
        phone: data.phone,
        company: data.company,
        documentType: data.documentType,
        documentNumber: data.documentNumber,
        vehiclePlate: data.vehiclePlate,
        visitorNotes: data.visitorNotes,
        consent: "true",
      }).forEach(([key, value]) => form.set(key, value));
      form.set("document", file);
      const response = await fetch(
        `/api/public/invitations/${encodeURIComponent(token)}/register`,
        { method: "POST", body: form },
      );
      const result = (await response.json()) as {
        qrToken?: string;
        error?: string;
      };
      if (!response.ok || !result.qrToken) {
        setError(result.error ?? "No fue posible completar el registro.");
        return;
      }
      setRemoteVisit({
        ...activeVisit,
        visitorName: data.fullName,
        company: data.company,
        status: "pre_registered",
        documentCaptured: true,
        consentedAt: new Date().toISOString(),
        qrToken: result.qrToken,
      });
      window.history.replaceState(null, "", `/pass/${result.qrToken}`);
      next("done");
      return;
    }
    const qrToken = activeVisit.qrToken ?? randomToken(32);
    await updateVisit(
      activeVisit.id,
      {
        ...data,
        visitorName: data.fullName,
        status: "pre_registered",
        documentCaptured: Boolean(file),
        consentedAt: new Date().toISOString(),
        qrToken,
      },
      { type: "pre_registered", actor: data.fullName },
    );
    next("done");
  }
  const field =
    "h-12 w-full rounded-xl border border-slate-200 px-4 outline-none focus:border-[#10aaa5] focus:ring-2 focus:ring-[#10cfc9]/15";
  return (
    <PublicFrame progress={Math.max(0, index) * 16.6}>
      {step === "welcome" && (
        <div className="text-center">
          <span className="mx-auto grid size-16 place-items-center rounded-2xl bg-cyan-50 text-[#0eaaa5]">
            <ShieldCheck size={30} />
          </span>
          <p className="mt-6 text-sm font-semibold text-[#0eaaa5]">
            NOVA LOGISTICS
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-.03em]">
            Prepara tu visita
          </h1>
          <p className="mx-auto mt-3 max-w-md text-slate-500">
            Completa tus datos y recibe un pase QR. Toma aproximadamente 3
            minutos.
          </p>
          <div className="my-7 rounded-2xl bg-slate-50 p-5 text-left">
            <p className="font-semibold">Visita con {visit.hostName}</p>
            <p className="mt-2 text-sm text-slate-500">{date}</p>
            <p className="mt-1 text-sm text-slate-500">
              {visit.location} · {visit.purpose}
            </p>
          </div>
          <button
            onClick={() => next("personal")}
            className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#071426] font-semibold text-white"
          >
            Comenzar <ArrowRight size={18} />
          </button>
          <p className="mt-4 flex items-center justify-center gap-1 text-xs text-slate-400">
            <LockKeyhole size={12} />
            Tu enlace es privado y vence después de la visita.
          </p>
        </div>
      )}
      {step === "personal" && (
        <StepBlock
          title="Tus datos"
          subtitle="Confirma la información de contacto para tu visita."
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nombre completo">
              <input
                className={field}
                value={data.fullName}
                onChange={(e) => setData({ ...data, fullName: e.target.value })}
              />
            </Field>
            <Field label="Correo">
              <input
                type="email"
                className={field}
                value={data.email}
                onChange={(e) => setData({ ...data, email: e.target.value })}
              />
            </Field>
            <Field label="Teléfono">
              <input
                className={field}
                value={data.phone}
                onChange={(e) => setData({ ...data, phone: e.target.value })}
              />
            </Field>
            <Field label="Empresa">
              <input
                className={field}
                value={data.company}
                onChange={(e) => setData({ ...data, company: e.target.value })}
              />
            </Field>
          </div>
          <Controls
            back={() => next("welcome")}
            next={() => {
              if (!data.fullName || !data.email || !data.company)
                setError("Completa los campos obligatorios.");
              else next("identity");
            }}
          />
        </StepBlock>
      )}
      {step === "identity" && (
        <StepBlock
          title="Identificación"
          subtitle="Usamos OCR para extraer texto. Esto no verifica la autenticidad del documento."
        >
          {progress > 0 && progress < 100 ? (
            <div className="py-10 text-center">
              <LoaderCircle
                className="mx-auto animate-spin text-[#10aaa5]"
                size={38}
              />
              <p className="mt-4 font-medium">Extrayendo información…</p>
              <div className="mx-auto mt-5 h-2 max-w-xs overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full bg-[#10cfc9] transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="mt-2 text-xs text-slate-400">{progress}%</p>
            </div>
          ) : (
            <>
              <label className="flex cursor-pointer flex-col items-center rounded-2xl border-2 border-dashed border-slate-200 p-8 text-center transition hover:border-[#10aaa5] hover:bg-cyan-50/40">
                <span className="grid size-14 place-items-center rounded-full bg-slate-100 text-slate-600">
                  <Camera size={25} />
                </span>
                <span className="mt-4 font-semibold">
                  Tomar foto o elegir archivo
                </span>
                <span className="mt-2 text-xs text-slate-500">
                  JPG, PNG o WebP · máximo 8 MB
                </span>
                <input
                  className="sr-only"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  capture="environment"
                  onChange={(e) =>
                    e.target.files?.[0] && processFile(e.target.files[0])
                  }
                />
              </label>
              <div className="mt-4 rounded-xl bg-blue-50 p-4 text-xs leading-5 text-blue-800">
                La imagen se guarda en almacenamiento privado y se elimina según
                la política de retención de la empresa.
              </div>
              <Controls
                back={() => next("personal")}
                next={() => next("review")}
                nextLabel="Capturar manualmente"
              />
            </>
          )}
        </StepBlock>
      )}
      {step === "review" && (
        <StepBlock
          title="Revisa la extracción"
          subtitle="Corrige cualquier dato. Los campos en amarillo tienen menor confianza."
        >
          <div className="mb-5 flex items-center justify-between rounded-xl bg-slate-50 p-3 text-sm">
            <span className="flex items-center gap-2">
              <FileImage size={17} /> {file?.name ?? "Captura manual"}
            </span>
            {ocr && (
              <span className="font-medium">
                Confianza {Math.round(ocr.confidence)}%
              </span>
            )}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nombre completo">
              <input
                className={field}
                value={data.fullName}
                onChange={(e) => setData({ ...data, fullName: e.target.value })}
              />
            </Field>
            <Field label="Tipo de identificación">
              <select
                className={field}
                value={data.documentType}
                onChange={(e) =>
                  setData({ ...data, documentType: e.target.value })
                }
              >
                <option>INE</option>
                <option>Pasaporte</option>
                <option>Licencia</option>
                <option>Otra</option>
              </select>
            </Field>
            <Field
              label="Número o folio"
              warning={Boolean(
                ocr &&
                ocr.fields.find(
                  (f) => f.name === "documentNumber" && f.confidence < 70,
                ),
              )}
            >
              <input
                className={field}
                value={data.documentNumber}
                onChange={(e) =>
                  setData({ ...data, documentNumber: e.target.value })
                }
              />
            </Field>
          </div>
          <Controls
            back={() => next("identity")}
            next={() => next("details")}
          />
        </StepBlock>
      )}
      {step === "details" && (
        <StepBlock
          title="Detalles finales"
          subtitle="Agrega información opcional que facilite tu acceso."
        >
          <div className="space-y-4">
            <Field label="Placas del vehículo (opcional)">
              <input
                className={field}
                value={data.vehiclePlate}
                onChange={(e) =>
                  setData({
                    ...data,
                    vehiclePlate: e.target.value.toUpperCase(),
                  })
                }
              />
            </Field>
            <Field label="Notas para recepción (opcional)">
              <textarea
                className="w-full rounded-xl border border-slate-200 p-4 outline-none focus:border-[#10aaa5]"
                rows={3}
                value={data.visitorNotes}
                onChange={(e) =>
                  setData({ ...data, visitorNotes: e.target.value })
                }
              />
            </Field>
          </div>
          <div className="mt-5 rounded-2xl bg-slate-50 p-5 text-sm">
            <p className="font-semibold">{visit.hostName}</p>
            <p className="mt-1 text-slate-500">
              {date} · {visit.location}
            </p>
            <p className="mt-1 text-slate-500">{visit.purpose}</p>
          </div>
          <Controls back={() => next("review")} next={() => next("consent")} />
        </StepBlock>
      )}
      {step === "consent" && (
        <StepBlock
          title="Privacidad y consentimiento"
          subtitle="Lee cómo se utilizará tu información."
        >
          <div className="max-h-56 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-5 text-sm leading-6 text-slate-600">
            <p className="font-semibold text-slate-900">
              Aviso de privacidad — versión MVP
            </p>
            <p className="mt-2">
              Nova Logistics solicita estos datos únicamente para gestionar y
              auditar tu acceso a sus instalaciones. La identificación se
              conservará durante 30 días y después será eliminada según la
              política configurada.
            </p>
            <p className="mt-2">
              No se realiza reconocimiento facial ni se almacenan datos
              biométricos. El OCR extrae texto y no verifica la autenticidad de
              tu documento.
            </p>
            <p className="mt-2 font-medium text-amber-700">
              Este aviso es demostrativo y debe ser revisado legalmente antes de
              producción.
            </p>
          </div>
          <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-4">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              className="mt-1 size-5 accent-[#10aaa5]"
            />
            <span className="text-sm leading-6">
              He leído el aviso y acepto el tratamiento de mis datos para
              gestionar esta visita.
            </span>
          </label>
          <Controls
            back={() => next("details")}
            next={finish}
            nextLabel="Aceptar y generar pase"
          />
        </StepBlock>
      )}
      {step === "done" && (
        <div className="text-center">
          <span className="mx-auto grid size-14 place-items-center rounded-full bg-emerald-50 text-emerald-600">
            <Check size={28} />
          </span>
          <h1 className="mt-4 text-2xl font-semibold">Tu pase está listo</h1>
          <p className="mt-2 text-sm text-slate-500">
            Muéstralo al personal de seguridad al llegar.
          </p>
          <div className="mx-auto mt-6 max-w-sm rounded-3xl border border-slate-200 bg-white p-5 shadow-lg">
            <p className="text-xs font-semibold tracking-widest text-slate-400">
              NEXA VISIT PASS
            </p>
            {qr ? (
              <img
                src={qr}
                alt="Código QR de acceso"
                className="mx-auto my-4 w-64"
              />
            ) : (
              <div className="mx-auto my-8 size-56 animate-pulse rounded-xl bg-slate-100" />
            )}
            <p className="font-semibold">
              {data.fullName || visit.visitorName}
            </p>
            <p className="mt-1 text-sm text-slate-500">
              {visit.hostName} · {visit.location}
            </p>
            <p className="mt-1 text-xs text-slate-400">{date}</p>
          </div>
          {qr && (
            <a
              download="nexa-visit-pass.png"
              href={qr}
              className="mt-5 inline-flex h-11 items-center gap-2 rounded-xl bg-[#071426] px-5 text-sm font-semibold text-white"
            >
              <Download size={17} />
              Descargar pase
            </a>
          )}
          <p className="mx-auto mt-5 max-w-md text-xs leading-5 text-slate-400">
            El QR contiene únicamente un token aleatorio. No incluye tu nombre
            ni datos personales.
          </p>
        </div>
      )}
      {error && (
        <div
          role="alert"
          className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700"
        >
          {error}
        </div>
      )}
    </PublicFrame>
  );
}

function PublicFrame({
  children,
  progress,
}: {
  children: React.ReactNode;
  progress?: number;
}) {
  return (
    <main className="min-h-screen bg-[#f7f9fc]">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-5 py-4">
          <Brand />
          <span className="flex items-center gap-1 text-xs text-slate-500">
            <LockKeyhole size={13} />
            Conexión segura
          </span>
        </div>
        {progress !== undefined && (
          <div className="h-1 bg-slate-100">
            <div
              className="h-full bg-[#10cfc9] transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}
      </header>
      <div className="mx-auto max-w-2xl px-5 py-10 sm:py-16">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-9">
          {children}
        </div>
      </div>
    </main>
  );
}
function StepBlock({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-[-.02em]">{title}</h1>
      <p className="mb-7 mt-2 text-sm text-slate-500">{subtitle}</p>
      {children}
    </>
  );
}
function Field({
  label,
  warning,
  children,
}: {
  label: string;
  warning?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label
      className={`block rounded-xl ${warning ? "bg-amber-50 p-3 ring-1 ring-amber-200" : ""}`}
    >
      <span className="mb-2 block text-sm font-medium">
        {label}
        {warning && (
          <span className="ml-2 text-xs font-normal text-amber-700">
            Revisar
          </span>
        )}
      </span>
      {children}
    </label>
  );
}
function Controls({
  back,
  next,
  nextLabel = "Continuar",
}: {
  back: () => void;
  next: () => void;
  nextLabel?: string;
}) {
  return (
    <div className="mt-7 flex items-center justify-between gap-3">
      <button
        onClick={back}
        className="inline-flex h-11 items-center gap-2 rounded-xl px-3 text-sm font-medium text-slate-500 hover:bg-slate-50"
      >
        <ArrowLeft size={17} />
        Atrás
      </button>
      <button
        onClick={next}
        className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#071426] px-5 text-sm font-semibold text-white"
      >
        {nextLabel}
        <ArrowRight size={17} />
      </button>
    </div>
  );
}
function StateCard({
  icon,
  title,
  text,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
}) {
  return (
    <div className="py-8 text-center">
      <span className="mx-auto grid size-14 place-items-center rounded-full bg-amber-50 text-amber-600">
        {icon}
      </span>
      <h1 className="mt-5 text-2xl font-semibold">{title}</h1>
      <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-slate-500">
        {text}
      </p>
      <Link
        href="/"
        className="mt-6 inline-block text-sm font-medium text-blue-600"
      >
        Volver al inicio
      </Link>
    </div>
  );
}
