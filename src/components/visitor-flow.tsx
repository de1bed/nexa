/* eslint-disable @next/next/no-img-element */
"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Building2,
  CalendarClock,
  Check,
  ChevronRight,
  Clock3,
  FileCheck2,
  Loader2,
  LockKeyhole,
  MapPin,
  Pencil,
  ScanFace,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { Brand } from "./brand";
import { Button, Callout, Field, cn, fieldClass } from "./ui";
import {
  DocumentCapture,
  type DocumentSide,
} from "./visitor/document-capture";
import { PassCard } from "./visitor/pass-card";
import { WalletButtons } from "./visitor/wallet-buttons";
import { getOCRProvider, LOW_CONFIDENCE, OCR_DISCLAIMER } from "@/lib/ocr";
import type { OCRResult } from "@/lib/ocr";
import { isLiveMode } from "@/lib/config";
import { documentTypes, formatIsoDate } from "@/lib/domain";
import { randomToken } from "@/lib/security";
import { showcaseOrganization, showcaseSettings } from "@/lib/demo-data";
import {
  getShowcaseServerSnapshot,
  getShowcaseSnapshot,
  patchShowcaseVisit,
  subscribeShowcase,
} from "@/lib/showcase-store";

type Step =
  | "welcome"
  | "identity"
  | "document"
  | "scanning"
  | "review"
  | "extras"
  | "consent"
  | "done";

const flow: Step[] = ["identity", "document", "review", "extras", "consent", "done"];

type FormField =
  | "fullName"
  | "email"
  | "phone"
  | "company"
  | "documentType"
  | "documentNumber"
  | "vehiclePlate"
  | "visitorNotes";

type Invitation = {
  visitId: string;
  state: "active" | "completed" | "expired" | "cancelled" | "invalid";
  organizationName: string;
  locationName: string;
  locationAddress: string;
  hostName: string;
  startsAt: string;
  endsAt: string;
  purpose: string;
  accessRequirements: string;
  privacyNotice: string;
  retentionDays: number;
  visitorName: string;
  visitorEmail: string;
  visitorPhone: string;
  visitorCompany: string;
};

const invalidInvitation = {
  visitId: "",
  state: "invalid",
} as Invitation;

export function VisitorFlow({ token }: { token: string }) {
  const live = isLiveMode();

  /* Vitrina: la invitación se deriva del store compartido, sin estado propio. */
  const showcaseState = useSyncExternalStore(
    subscribeShowcase,
    getShowcaseSnapshot,
    getShowcaseServerSnapshot,
  );
  const showcaseVisit = live
    ? undefined
    : showcaseState.visits.find((visit) => visit.invitationToken === token);

  const [remoteInvitation, setRemoteInvitation] = useState<Invitation | null>(
    null,
  );
  const [loading, setLoading] = useState(live);
  const [step, setStep] = useState<Step>("welcome");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const topRef = useRef<HTMLDivElement>(null);

  /**
   * Solo se guarda lo que el visitante escribe. Lo que ya se conoce (datos
   * adelantados por el anfitrión, campos leídos del documento) se combina al
   * renderizar, así nunca se pisa una corrección hecha a mano.
   */
  const [edits, setEdits] = useState<Partial<Record<FormField, string>>>({});
  /** Una credencial tiene dos caras: el frente identifica, el reverso se lee. */
  const [files, setFiles] = useState<Partial<Record<DocumentSide, File>>>({});
  const [previews, setPreviews] = useState<Partial<Record<DocumentSide, string>>>(
    {},
  );
  const [capturing, setCapturing] = useState<DocumentSide | null>(null);
  const [ocr, setOcr] = useState<OCRResult | null>(null);
  const [progress, setProgress] = useState(0);
  const [consent, setConsent] = useState(false);
  const [passToken, setPassToken] = useState("");
  const [wallet, setWallet] = useState<{ apple?: boolean; google?: boolean }>();

  const invitation: Invitation | null = useMemo(() => {
    if (live) return remoteInvitation;
    if (!showcaseVisit) return invalidInvitation;
    return {
          visitId: showcaseVisit.id,
          state:
            showcaseVisit.status === "cancelled"
              ? "cancelled"
              : showcaseVisit.qrToken
                ? "completed"
                : "active",
          organizationName: showcaseOrganization.name,
          locationName: showcaseVisit.location,
          locationAddress: showcaseVisit.locationAddress ?? "",
          hostName: showcaseVisit.hostName,
          startsAt: showcaseVisit.startsAt,
          endsAt: showcaseVisit.endsAt,
          purpose: showcaseVisit.purpose,
          accessRequirements: showcaseVisit.accessRequirements ?? "",
          privacyNotice: showcaseSettings.privacyNotice,
          retentionDays: showcaseSettings.documentRetentionDays,
          visitorName: showcaseVisit.inviteeName ?? "",
          visitorEmail: showcaseVisit.inviteeEmail ?? "",
          visitorPhone: showcaseVisit.inviteePhone ?? "",
      visitorCompany: showcaseVisit.inviteeCompany ?? "",
    };
  }, [live, remoteInvitation, showcaseVisit]);

  /* ------------------------------------------------------------------ */
  /* Carga (solo en modo real)                                           */
  /* ------------------------------------------------------------------ */
  useEffect(() => {
    if (!live) return;
    let active = true;

    void (async () => {
      try {
        const response = await fetch(
          `/api/public/invitations/${encodeURIComponent(token)}`,
          { cache: "no-store" },
        );
        if (!response.ok) throw new Error("invalid");
        const row = (await response.json()) as Record<string, string>;
        if (!active) return;
        setRemoteInvitation({
          visitId: row.visit_id,
          state: row.state as Invitation["state"],
          organizationName: row.organization_name,
          locationName: row.location_name,
          locationAddress: row.location_address ?? "",
          hostName: row.host_name,
          startsAt: row.starts_at,
          endsAt: row.ends_at,
          purpose: row.purpose,
          accessRequirements: row.access_requirements ?? "",
          privacyNotice: row.privacy_notice ?? "",
          retentionDays: Number(row.retention_days ?? 30),
          visitorName: row.visitor_name ?? "",
          visitorEmail: row.visitor_email ?? "",
          visitorPhone: row.visitor_phone ?? "",
          visitorCompany: row.visitor_company ?? "",
        });
      } catch {
        if (active) setRemoteInvitation(invalidInvitation);
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [live, token]);

  /* Valor efectivo de cada campo: edición > dato adelantado > lectura OCR. */
  const value = useCallback(
    (name: FormField): string => {
      const edited = edits[name];
      if (edited !== undefined) return edited;
      switch (name) {
        case "fullName":
          return invitation?.visitorName || ocr?.fullName || "";
        case "email":
          return invitation?.visitorEmail || "";
        case "phone":
          return invitation?.visitorPhone || "";
        case "company":
          return invitation?.visitorCompany || "";
        case "documentType":
          return documentTypes[0];
        case "documentNumber":
          return ocr?.documentNumber || "";
        default:
          return "";
      }
    },
    [edits, invitation, ocr],
  );

  const set = useCallback((name: FormField, next: string) => {
    setEdits((current) => ({ ...current, [name]: next }));
  }, []);

  const go = useCallback((next: Step) => {
    setError("");
    setStep(next);
    topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  /* ------------------------------------------------------------------ */
  /* Lectura del documento                                               */
  /* ------------------------------------------------------------------ */
  const runOcr = useCallback(
    async (image: File) => {
      go("scanning");
      setProgress(12);
      const timer = setInterval(
        () => setProgress((current) => Math.min(90, current + 9)),
        160,
      );
      try {
        const provider = await getOCRProvider();
        const result = await provider.extractIdentityData(image);
        setOcr(result);
        setProgress(100);
        setTimeout(() => go("review"), 420);
      } catch {
        setOcr(null);
        setProgress(100);
        setError(
          "No pudimos leer la imagen automáticamente. Puedes escribir tus datos a mano.",
        );
        setTimeout(() => go("review"), 300);
      } finally {
        clearInterval(timer);
      }
    },
    [go],
  );

  /* ------------------------------------------------------------------ */
  /* Envío                                                               */
  /* ------------------------------------------------------------------ */
  async function submit() {
    if (!consent) {
      setError("Necesitamos tu consentimiento para registrar la visita.");
      return;
    }
    if (!files.front || !files.back) {
      setError("Faltan las fotos de tu identificación.");
      go("document");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      if (live) {
        const form = new FormData();
        const fields: Array<[string, string]> = [
          ["fullName", value("fullName")],
          ["email", value("email")],
          ["phone", value("phone")],
          ["company", value("company")],
          ["documentType", value("documentType")],
          ["documentNumber", value("documentNumber")],
          ["vehiclePlate", value("vehiclePlate")],
          ["visitorNotes", value("visitorNotes")],
        ];
        fields.forEach(([key, fieldValue]) => {
          if (fieldValue) form.set(key, fieldValue);
        });
        if (ocr) {
          form.set("ocrConfidence", String(Math.round(ocr.confidence)));
          form.set("ocrVerified", ocr.mrz?.verified ? "true" : "false");
          if (ocr.expiryDate) form.set("documentExpiresAt", ocr.expiryDate);
        }
        form.set("consent", "true");
        form.set("documentFront", files.front);
        form.set("documentBack", files.back);

        const response = await fetch(
          `/api/public/invitations/${encodeURIComponent(token)}/register`,
          { method: "POST", body: form },
        );
        const payload = (await response.json()) as {
          qrToken?: string;
          wallet?: { apple?: boolean; google?: boolean };
          error?: string;
        };
        if (!response.ok || !payload.qrToken)
          throw new Error(payload.error ?? "No fue posible completar tu registro");

        setPassToken(payload.qrToken);
        setWallet(payload.wallet);
        window.history.replaceState(null, "", `/pass/${payload.qrToken}`);
      } else {
        const generated = randomToken(24);
        const documentNumber = value("documentNumber");
        patchShowcaseVisit(
          invitation!.visitId,
          {
            visitorName: value("fullName"),
            email: value("email"),
            phone: value("phone"),
            company: value("company"),
            documentType: value("documentType"),
            documentMasked: documentNumber
              ? `•••• ${documentNumber.slice(-4)}`
              : undefined,
            vehiclePlate: value("vehiclePlate") || undefined,
            visitorNotes: value("visitorNotes") || undefined,
            status: "pre_registered",
            documentCaptured: true,
            consentedAt: new Date().toISOString(),
            qrToken: generated,
          },
          { type: "pre_registered", actor: value("fullName") },
        );
        setPassToken(generated);
      }
      go("done");
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "No fue posible completar tu registro",
      );
    } finally {
      setSubmitting(false);
    }
  }

  /* ------------------------------------------------------------------ */
  /* Estados de portada                                                  */
  /* ------------------------------------------------------------------ */
  const stepIndex = flow.indexOf(step);
  const progressValue =
    step === "welcome" ? 0 : ((Math.max(0, stepIndex) + 1) / flow.length) * 100;

  const dateLabel = useMemo(
    () =>
      invitation?.startsAt
        ? new Intl.DateTimeFormat("es-MX", {
            dateStyle: "full",
            timeStyle: "short",
          }).format(new Date(invitation.startsAt))
        : "",
    [invitation],
  );

  if (loading)
    return (
      <Frame>
        <div className="py-20 text-center">
          <Loader2 className="mx-auto animate-spin text-[#10aaa5]" size={38} />
          <p className="mt-4 text-sm text-slate-500">Validando tu invitación…</p>
        </div>
      </Frame>
    );

  if (!invitation || invitation.state === "invalid")
    return (
      <Frame>
        <StateCard
          tone="warning"
          icon={AlertTriangle}
          title="Enlace no disponible"
          text="El enlace no es válido, ya venció o fue revocado. Pide a tu anfitrión que te envíe uno nuevo."
        />
      </Frame>
    );

  if (invitation.state === "cancelled")
    return (
      <Frame>
        <StateCard
          tone="warning"
          icon={AlertTriangle}
          title="Visita cancelada"
          text={`${invitation.hostName} canceló esta visita. Contáctalo si necesitas reagendar.`}
        />
      </Frame>
    );

  if (invitation.state === "expired")
    return (
      <Frame>
        <StateCard
          tone="warning"
          icon={Clock3}
          title="El enlace venció"
          text="La ventana de esta invitación terminó. Solicita una nueva a tu anfitrión."
        />
      </Frame>
    );

  if (invitation.state === "completed" && step !== "done")
    return (
      <Frame>
        <StateCard
          tone="success"
          icon={BadgeCheck}
          title="Tu registro ya está completo"
          text="Revisa el correo donde recibiste tu pase para mostrar el código QR en recepción."
        />
      </Frame>
    );

  /* ------------------------------------------------------------------ */
  return (
    <Frame progress={progressValue}>
      <div ref={topRef} className="scroll-mt-24" />

      {step === "welcome" && (
        <div className="animate-rise text-center">
          <span className="mx-auto grid size-[72px] place-items-center rounded-[26px] bg-[#10cfc9]/15 text-[#0d9d99]">
            <Sparkles size={32} />
          </span>
          <p className="mt-6 text-[13px] font-semibold uppercase tracking-[.18em] text-[#0d9d99]">
            {invitation.organizationName}
          </p>
          <h1 className="mt-3 text-[30px] font-semibold leading-[1.15] tracking-[-.035em]">
            {invitation.hostName} te está esperando
          </h1>
          <p className="mx-auto mt-3 max-w-sm text-[15px] leading-6 text-slate-500">
            {value("fullName") ? `Hola, ${value("fullName").split(" ")[0]}. ` : ""}
            Prepara tu visita en dos minutos y entra sin filas.
          </p>

          <div className="mt-7 space-y-3 text-left">
            <SummaryRow icon={CalendarClock} label="Cuándo" value={dateLabel} />
            <SummaryRow
              icon={MapPin}
              label="Dónde"
              value={invitation.locationName}
              hint={invitation.locationAddress}
            />
            <SummaryRow icon={FileCheck2} label="Motivo" value={invitation.purpose} />
            {invitation.accessRequirements && (
              <SummaryRow
                icon={ShieldCheck}
                label="Requisitos"
                value={invitation.accessRequirements}
              />
            )}
          </div>

          <div className="mt-7 space-y-3">
            <Button variant="accent" size="lg" block onClick={() => go("identity")}>
              Comenzar mi registro
              <ArrowRight size={19} />
            </Button>
            <p className="flex items-center justify-center gap-1.5 text-xs text-slate-400">
              <LockKeyhole size={13} />
              Enlace personal · vence después de la visita
            </p>
          </div>
        </div>
      )}

      {step === "identity" && (
        <StepShell
          index={1}
          title="Tus datos"
          subtitle={
            invitation.visitorName || invitation.visitorEmail
              ? "Tu anfitrión adelantó algunos datos. Confírmalos o corrígelos."
              : "Necesitamos lo mínimo para identificarte en recepción."
          }
          onBack={() => go("welcome")}
          onNext={() => {
            if (value("fullName").trim().length < 2)
              return setError("Escribe tu nombre completo.");
            if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value("email")))
              return setError("Escribe un correo válido.");
            if (value("phone").trim().length < 7)
              return setError("Escribe un teléfono de contacto.");
            if (value("company").trim().length < 2)
              return setError("Escribe la empresa que representas.");
            go("document");
          }}
          error={error}
        >
          <div className="space-y-4">
            <Field label="Nombre completo">
              <input
                className={fieldClass}
                autoComplete="name"
                placeholder="Como aparece en tu identificación"
                value={value("fullName")}
                onChange={(event) => set("fullName", event.target.value)}
              />
            </Field>
            <Field label="Correo" hint="Ahí te enviaremos tu pase de acceso.">
              <input
                className={fieldClass}
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="tu@empresa.com"
                value={value("email")}
                onChange={(event) => set("email", event.target.value)}
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Teléfono">
                <input
                  className={fieldClass}
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="55 1234 5678"
                  value={value("phone")}
                  onChange={(event) => set("phone", event.target.value)}
                />
              </Field>
              <Field label="Empresa">
                <input
                  className={fieldClass}
                  autoComplete="organization"
                  placeholder="A quién representas"
                  value={value("company")}
                  onChange={(event) => set("company", event.target.value)}
                />
              </Field>
            </div>
          </div>
        </StepShell>
      )}

      {step === "document" &&
        (capturing ? (
          <div className="animate-rise">
            <p className="text-[13px] font-semibold text-[#0d9d99]">Paso 2 de 5</p>
            <h1 className="mt-2 text-[26px] font-semibold leading-tight tracking-[-.03em]">
              Tu identificación
            </h1>
            <p className="mb-6 mt-2 text-[15px] leading-6 text-slate-500">
              Encuadra la credencial y toma la foto.
            </p>

            <DocumentCapture
              side={capturing}
              onCancel={() => setCapturing(null)}
              onCaptured={(captured, url) => {
                setFiles((current) => ({ ...current, [capturing]: captured }));
                setPreviews((current) => ({ ...current, [capturing]: url }));
                setCapturing(null);
              }}
            />
          </div>
        ) : (
          <StepShell
            index={2}
            title="Tu identificación"
            subtitle="Necesitamos las dos caras. El reverso trae los datos que leemos automáticamente."
            onBack={() => go("identity")}
            onNext={() => {
              if (!files.front)
                return setError("Falta la foto del frente de tu identificación.");
              if (!files.back)
                return setError("Falta la foto del reverso de tu identificación.");
              void runOcr(files.back);
            }}
            nextLabel="Leer mi identificación"
            error={error}
          >
            <div className="mb-5">
              <Field label="Tipo de identificación">
                <select
                  className={fieldClass}
                  value={value("documentType")}
                  onChange={(event) => set("documentType", event.target.value)}
                >
                  {documentTypes.map((type) => (
                    <option key={type}>{type}</option>
                  ))}
                </select>
              </Field>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {(["front", "back"] as DocumentSide[]).map((side) => (
                <SideSlot
                  key={side}
                  side={side}
                  preview={previews[side]}
                  onPick={() => {
                    setError("");
                    setCapturing(side);
                  }}
                />
              ))}
            </div>

            <Callout tone="info" icon={ShieldCheck} className="mt-5">
              La lectura ocurre en tu propio teléfono: la imagen no se envía a
              ningún servicio externo para analizarla.
            </Callout>
          </StepShell>
        ))}

      {step === "scanning" && (
        <div className="animate-rise py-14 text-center">
          <div className="relative mx-auto grid size-28 place-items-center">
            <span className="animate-pulse-ring absolute inset-0 rounded-full border-2 border-[#10cfc9]" />
            <span className="grid size-24 place-items-center rounded-full bg-[#10cfc9]/12 text-[#0d9d99]">
              <ScanFace size={40} />
            </span>
          </div>
          <h2 className="mt-7 text-xl font-semibold">Leyendo tu identificación</h2>
          <p className="mt-2 text-sm text-slate-500">
            Extraemos el texto en tu propio dispositivo.
          </p>
          <div className="mx-auto mt-6 h-2 max-w-[220px] overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-[#10cfc9] transition-all duration-200"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="mt-2 text-xs font-medium text-slate-400">{progress}%</p>
        </div>
      )}

      {step === "review" && (
        <StepShell
          index={3}
          title="Revisa lo que leímos"
          subtitle="Corrige cualquier dato. Tú tienes la última palabra."
          onBack={() => go("document")}
          onNext={() => {
            if (!value("fullName").trim())
              return setError("El nombre no puede quedar vacío.");
            go("extras");
          }}
          error={error}
        >
          <div className="mb-5 flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
            {previews.front ? (
              <img
                src={previews.front}
                alt=""
                className="size-16 shrink-0 overflow-hidden rounded-xl bg-white object-cover text-[0px]"
              />
            ) : (
              <span className="grid size-16 place-items-center rounded-xl bg-white text-slate-400">
                <FileCheck2 size={22} />
              </span>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">Identificación capturada</p>
              <p className="mt-0.5 text-xs text-slate-500">
                {ocr
                  ? `Confianza de lectura ${Math.round(ocr.confidence)}%`
                  : "Captura manual"}
              </p>
            </div>
            <button
              type="button"
              onClick={() => go("document")}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold active:bg-slate-50"
            >
              <Pencil size={14} />
              Repetir
            </button>
          </div>

          {/* La banda del reverso trae dígitos de control: cuando cuadran, los
              datos no son una conjetura del OCR sino una lectura comprobada. */}
          {ocr?.mrz?.verified && (
            <Callout tone="success" icon={BadgeCheck} className="mb-4">
              <b>Lectura verificada.</b> Los datos coinciden con los dígitos de
              control de tu credencial.
              {ocr.expiryDate && (
                <>
                  {" "}
                  Vigencia hasta {formatIsoDate(ocr.expiryDate)}.
                </>
              )}
            </Callout>
          )}

          {ocr?.expired && (
            <Callout tone="warning" icon={AlertTriangle} className="mb-4">
              Tu identificación aparece como <b>vencida</b>. Puedes continuar,
              pero es posible que en recepción te pidan otra.
            </Callout>
          )}

          {ocr && !ocr.mrz && (
            <Callout tone="neutral" icon={AlertTriangle} className="mb-4">
              No pudimos leer la banda del reverso. Revisa o escribe tus datos a
              mano.
            </Callout>
          )}

          <div className="space-y-4">
            <Field
              label="Nombre completo"
              warning={hasLowConfidence(ocr, "fullName")}
            >
              <input
                className={fieldClass}
                value={value("fullName")}
                onChange={(event) => set("fullName", event.target.value)}
              />
            </Field>
            <Field
              label="Número o folio"
              optional
              hint="Solo guardamos los últimos cuatro dígitos."
              warning={hasLowConfidence(ocr, "documentNumber")}
            >
              <input
                className={fieldClass}
                value={value("documentNumber")}
                onChange={(event) => set("documentNumber", event.target.value)}
              />
            </Field>
          </div>

          <Callout tone="info" icon={ShieldCheck} className="mt-5">
            {OCR_DISCLAIMER}
          </Callout>
        </StepShell>
      )}

      {step === "extras" && (
        <StepShell
          index={4}
          title="Detalles finales"
          subtitle="Opcional, pero agiliza tu entrada."
          onBack={() => go("review")}
          onNext={() => go("consent")}
          error={error}
        >
          <div className="space-y-4">
            <Field label="Placas del vehículo" optional>
              <input
                className={fieldClass}
                placeholder="ABC-1234"
                value={value("vehiclePlate")}
                onChange={(event) =>
                  set("vehiclePlate", event.target.value.toUpperCase())
                }
              />
            </Field>
            <Field label="Notas para recepción" optional>
              <textarea
                rows={3}
                className="w-full rounded-2xl border border-slate-200 bg-white p-4 text-[16px] outline-none focus:border-[#10aaa5] focus:ring-4 focus:ring-[#10cfc9]/15"
                placeholder="Traigo equipo, llego con un acompañante…"
                value={value("visitorNotes")}
                onChange={(event) => set("visitorNotes", event.target.value)}
              />
            </Field>
          </div>

          <div className="mt-6 rounded-2xl bg-slate-50 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-400">
              Tu visita
            </p>
            <p className="mt-1.5 font-semibold">{invitation.hostName}</p>
            <p className="mt-1 text-sm text-slate-500">{dateLabel}</p>
            <p className="text-sm text-slate-500">{invitation.locationName}</p>
          </div>
        </StepShell>
      )}

      {step === "consent" && (
        <StepShell
          index={5}
          title="Privacidad"
          subtitle="Lee cómo se usará tu información antes de continuar."
          onBack={() => go("extras")}
          onNext={submit}
          nextLabel={submitting ? "Generando tu pase…" : "Aceptar y generar pase"}
          nextDisabled={!consent || submitting}
          busy={submitting}
          error={error}
        >
          <div className="max-h-64 overflow-y-auto rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm leading-6 text-slate-600">
            <p className="font-semibold text-[#071426]">
              Aviso de privacidad · {invitation.organizationName}
            </p>
            <p className="mt-2 whitespace-pre-line">
              {invitation.privacyNotice ||
                "Los datos se utilizan únicamente para gestionar y auditar tu acceso a las instalaciones."}
            </p>
            <p className="mt-3">
              Tu identificación se conserva{" "}
              <b>{invitation.retentionDays} días</b> y después se elimina de forma
              permanente. {OCR_DISCLAIMER}
            </p>
          </div>

          <button
            type="button"
            onClick={() => setConsent(!consent)}
            className={cn(
              "mt-4 flex w-full items-start gap-3 rounded-2xl border p-4 text-left transition",
              consent ? "border-[#10cfc9] bg-[#10cfc9]/10" : "border-slate-200 bg-white",
            )}
          >
            <span
              className={cn(
                "mt-0.5 grid size-6 shrink-0 place-items-center rounded-lg border-2 transition",
                consent ? "border-[#0d9d99] bg-[#10cfc9] text-white" : "border-slate-300",
              )}
            >
              {consent && <Check size={15} strokeWidth={3} />}
            </span>
            <span className="text-sm leading-6 text-[#071426]">
              He leído el aviso y acepto el tratamiento de mis datos para
              gestionar esta visita.
            </span>
          </button>
        </StepShell>
      )}

      {step === "done" && (
        <div className="animate-rise text-center">
          <span className="animate-pop mx-auto grid size-16 place-items-center rounded-full bg-emerald-50 text-emerald-600">
            <Check size={32} strokeWidth={3} />
          </span>
          <h1 className="mt-5 text-[26px] font-semibold tracking-[-.03em]">
            ¡Todo listo!
          </h1>
          <p className="mt-2 text-[15px] text-slate-500">
            Muestra este código al llegar a recepción.
          </p>

          <div className="mt-7">
            <PassCard
              token={passToken}
              visitorName={value("fullName")}
              organizationName={invitation.organizationName}
              hostName={invitation.hostName}
              location={invitation.locationName}
              startsAt={invitation.startsAt}
              accessRequirements={invitation.accessRequirements || undefined}
            />
          </div>

          <div className="mt-6 space-y-4">
            <WalletButtons token={passToken} available={wallet} />

            <Link
              href={`/pass/${passToken}`}
              className="inline-flex h-13 w-full items-center justify-center gap-2 rounded-2xl bg-[#071426] text-[15px] font-semibold text-white"
            >
              Abrir mi pase
              <ChevronRight size={18} />
            </Link>
            <p className="mx-auto max-w-xs text-xs leading-5 text-slate-400">
              También te lo enviamos por correo. El código contiene solo un token
              aleatorio, sin tus datos personales.
            </p>
          </div>
        </div>
      )}
    </Frame>
  );
}

function hasLowConfidence(ocr: OCRResult | null, field: string) {
  return Boolean(
    ocr?.fields.some(
      (item) => item.name === field && item.confidence < LOW_CONFIDENCE,
    ),
  );
}

/* -------------------------------------------------------------------------- */
/* Presentación                                                                */
/* -------------------------------------------------------------------------- */

function Frame({
  children,
  progress,
}: {
  children: React.ReactNode;
  progress?: number;
}) {
  return (
    <main className="min-h-screen bg-[#f4f7fb]">
      <header className="safe-top sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur-lg">
        <div className="mx-auto flex h-15 max-w-2xl items-center justify-between px-5">
          <Brand href="#" />
          <span className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500">
            <LockKeyhole size={13} />
            Conexión segura
          </span>
        </div>
        {progress !== undefined && (
          <div className="h-1 bg-slate-100">
            <div
              className="h-full bg-[#10cfc9] transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}
      </header>

      <div className="safe-bottom mx-auto max-w-2xl px-4 py-7 sm:px-6 sm:py-12">
        <div className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-[0_1px_2px_rgba(7,20,38,.04),0_18px_48px_-30px_rgba(7,20,38,.4)] sm:p-8">
          {children}
        </div>
      </div>
    </main>
  );
}

function StepShell({
  index,
  title,
  subtitle,
  children,
  onBack,
  onNext,
  nextLabel = "Continuar",
  nextDisabled,
  hideNext,
  busy,
  error,
}: {
  index: number;
  title: string;
  subtitle: string;
  children: React.ReactNode;
  onBack: () => void;
  onNext?: () => void;
  nextLabel?: string;
  nextDisabled?: boolean;
  hideNext?: boolean;
  busy?: boolean;
  error?: string;
}) {
  return (
    <div className="animate-rise">
      <p className="text-[13px] font-semibold text-[#0d9d99]">Paso {index} de 5</p>
      <h1 className="mt-2 text-[26px] font-semibold leading-tight tracking-[-.03em]">
        {title}
      </h1>
      <p className="mb-6 mt-2 text-[15px] leading-6 text-slate-500">{subtitle}</p>

      {children}

      {error && (
        <div
          role="alert"
          className="mt-5 flex items-start gap-2 rounded-2xl bg-red-50 p-4 text-sm leading-6 text-red-700"
        >
          <AlertTriangle size={17} className="mt-0.5 shrink-0" />
          {error}
        </div>
      )}

      <div className="mt-7 flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex h-13 items-center gap-1.5 rounded-2xl px-3 text-sm font-medium text-slate-500 active:bg-slate-100"
        >
          <ArrowLeft size={18} />
          Atrás
        </button>
        {!hideNext && onNext && (
          <Button
            variant="accent"
            size="lg"
            onClick={onNext}
            disabled={nextDisabled}
            className="flex-1"
          >
            {busy && <Loader2 size={18} className="animate-spin" />}
            {nextLabel}
            {!busy && <ArrowRight size={18} />}
          </Button>
        )}
      </div>
    </div>
  );
}

/** Casilla de una de las dos caras: vacía invita a capturar, llena deja repetir. */
function SideSlot({
  side,
  preview,
  onPick,
}: {
  side: DocumentSide;
  preview?: string;
  onPick: () => void;
}) {
  const label = side === "front" ? "Frente" : "Reverso";
  const hint = side === "front" ? "Con tu foto" : "Con las líneas de datos";

  return (
    <button
      type="button"
      onClick={onPick}
      className={cn(
        "flex w-full items-center gap-3 rounded-2xl border-2 p-3 text-left transition active:scale-[.99]",
        preview
          ? "border-[#10cfc9] bg-[#10cfc9]/[.07]"
          : "border-dashed border-slate-200 bg-white",
      )}
    >
      {preview ? (
        <img
          src={preview}
          alt=""
          className="size-16 shrink-0 overflow-hidden rounded-xl bg-white object-cover text-[0px]"
        />
      ) : (
        <span className="grid size-16 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-400">
          <ScanFace size={24} />
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5 font-semibold">
          {label}
          {preview && <Check size={15} className="text-[#0d9d99]" />}
        </span>
        <span className="mt-0.5 block text-xs text-slate-500">
          {preview ? "Tocar para repetir" : hint}
        </span>
      </span>
    </button>
  );
}

function SummaryRow({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: typeof MapPin;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-2xl bg-slate-50 p-4">
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white text-slate-500 shadow-sm">
        <Icon size={18} />
      </span>
      <div className="min-w-0">
        <p className="text-[11px] uppercase tracking-wide text-slate-400">
          {label}
        </p>
        <p className="mt-0.5 text-sm font-semibold leading-5">{value}</p>
        {hint && <p className="mt-0.5 text-xs text-slate-500">{hint}</p>}
      </div>
    </div>
  );
}

function StateCard({
  icon: Icon,
  title,
  text,
  tone,
}: {
  icon: typeof AlertTriangle;
  title: string;
  text: string;
  tone: "warning" | "success";
}) {
  return (
    <div className="py-8 text-center">
      <span
        className={cn(
          "mx-auto grid size-16 place-items-center rounded-full",
          tone === "success"
            ? "bg-emerald-50 text-emerald-600"
            : "bg-amber-50 text-amber-600",
        )}
      >
        <Icon size={30} />
      </span>
      <h1 className="mt-5 text-2xl font-semibold tracking-[-.02em]">{title}</h1>
      <p className="mx-auto mt-2.5 max-w-sm text-[15px] leading-6 text-slate-500">
        {text}
      </p>
      <Link
        href="/"
        className="mt-7 inline-flex h-12 items-center gap-2 rounded-2xl border border-slate-200 px-5 text-sm font-semibold"
      >
        <Building2 size={17} />
        Conocer NEXA VISIT
      </Link>
    </div>
  );
}
