"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, Images, RefreshCcw, ScanLine, ShieldCheck, X } from "lucide-react";
import { Button, Callout, cn } from "../ui";
import {
  ACCEPTED_IMAGE_TYPES,
  captureFrame,
  compressIdentityImage,
  validateImage,
} from "@/lib/image";

export type DocumentSide = "front" | "back";

const copy: Record<DocumentSide, { title: string; hint: string }> = {
  front: {
    title: "Frente de tu identificación",
    hint: "El lado con tu fotografía",
  },
  back: {
    title: "Reverso de tu identificación",
    hint: "El lado con las líneas de letras y números",
  },
};

/**
 * Captura de identificación pensada para el teléfono: cámara en vivo con marco
 * guía y, como respaldo garantizado, la galería del sistema. Nunca deja al
 * visitante sin una vía para continuar.
 */
export function DocumentCapture({
  side,
  onCaptured,
  onCancel,
}: {
  side: DocumentSide;
  onCaptured: (file: File, preview: string) => void;
  onCancel?: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraState, setCameraState] = useState<
    "idle" | "starting" | "ready" | "unavailable"
  >("idle");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraState("unavailable");
        return;
      }
      setCameraState("starting");
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => undefined);
        }
        setCameraState("ready");
      } catch (reason) {
        if (cancelled) return;
        setCameraState("unavailable");
        setError(
          reason instanceof Error && reason.name === "NotAllowedError"
            ? "No diste permiso de cámara. Puedes subir una foto desde tu galería."
            : "No encontramos una cámara disponible. Sube una foto desde tu galería.",
        );
      }
    }

    void start();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, []);

  async function handleFile(file: File) {
    const invalid = validateImage(file);
    if (invalid) {
      setError(invalid);
      return;
    }
    setError("");
    setBusy(true);
    try {
      const compressed = await compressIdentityImage(file).catch(() => null);
      if (!compressed) {
        setError("No pudimos leer esa foto. Tómala de nuevo o usa JPG.");
        return;
      }
      onCaptured(compressed, URL.createObjectURL(compressed));
    } finally {
      setBusy(false);
    }
  }

  async function shoot() {
    if (!videoRef.current) return;
    setBusy(true);
    setError("");
    try {
      const file = await captureFrame(videoRef.current);
      streamRef.current?.getTracks().forEach((track) => track.stop());
      onCaptured(file, URL.createObjectURL(file));
    } catch {
      setError("No pudimos tomar la foto. Intenta de nuevo.");
    } finally {
      setBusy(false);
    }
  }

  const live = cameraState === "ready";

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-slate-50 p-3 text-center">
        <p className="text-sm font-semibold">{copy[side].title}</p>
        <p className="mt-0.5 text-xs text-slate-500">{copy[side].hint}</p>
      </div>

      <div className="relative aspect-[3/4] w-full overflow-hidden rounded-3xl bg-slate-900 sm:aspect-[4/3]">
        <video
          ref={videoRef}
          playsInline
          muted
          autoPlay
          className={cn(
            "size-full object-cover transition-opacity",
            live ? "opacity-100" : "opacity-0",
          )}
        />

        {/* Marco guía: enseña dónde colocar la credencial. */}
        <div className="pointer-events-none absolute inset-0 grid place-items-center p-6">
          <div className="relative aspect-[1.586/1] w-full max-w-xs">
            <span className="absolute -left-1 -top-1 size-9 rounded-tl-2xl border-l-4 border-t-4 border-[#10cfc9]" />
            <span className="absolute -right-1 -top-1 size-9 rounded-tr-2xl border-r-4 border-t-4 border-[#10cfc9]" />
            <span className="absolute -bottom-1 -left-1 size-9 rounded-bl-2xl border-b-4 border-l-4 border-[#10cfc9]" />
            <span className="absolute -bottom-1 -right-1 size-9 rounded-br-2xl border-b-4 border-r-4 border-[#10cfc9]" />

            {/* En el reverso se resalta la franja donde vive la banda MRZ. */}
            {side === "back" && (
              <span className="absolute inset-x-3 bottom-2 h-[38%] rounded-lg border-2 border-dashed border-[#10cfc9]/70" />
            )}
            {live && side === "front" && (
              <span className="animate-sweep absolute inset-x-2 top-1/2 h-0.5 rounded-full bg-[#10cfc9] shadow-[0_0_18px_4px_rgba(16,207,201,.55)]" />
            )}
          </div>
        </div>

        {!live && (
          <div className="absolute inset-0 grid place-items-center p-6 text-center">
            {cameraState === "starting" ? (
              <div className="text-slate-300">
                <span className="mx-auto grid size-14 place-items-center rounded-full bg-white/10">
                  <Camera size={24} />
                </span>
                <p className="mt-4 text-sm">Encendiendo la cámara…</p>
              </div>
            ) : (
              <div className="text-slate-300">
                <span className="mx-auto grid size-14 place-items-center rounded-full bg-white/10">
                  <Images size={24} />
                </span>
                <p className="mt-4 max-w-xs text-sm leading-6">
                  Sube una foto desde la galería.
                </p>
              </div>
            )}
          </div>
        )}

        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            aria-label="Cancelar captura"
            className="absolute right-3 top-3 grid size-10 place-items-center rounded-full bg-black/45 text-white backdrop-blur"
          >
            <X size={18} />
          </button>
        )}

        <p className="absolute inset-x-0 bottom-3 text-center text-[11px] font-medium text-white/80">
          {side === "back"
            ? "Encuadra las líneas de letras y números"
            : "Coloca la credencial dentro del marco, sin reflejos"}
        </p>
      </div>

      {error && <Callout tone="warning">{error}</Callout>}

      <div className="flex items-center gap-3">
        <label className="inline-flex h-14 flex-1 cursor-pointer items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white text-[15px] font-semibold text-[#071426] active:bg-slate-50">
          <Images size={19} />
          Galería
          <input
            type="file"
            accept={ACCEPTED_IMAGE_TYPES.join(",")}
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void handleFile(file);
              event.target.value = "";
            }}
          />
        </label>

        {live ? (
          <button
            type="button"
            onClick={shoot}
            disabled={busy}
            aria-label="Tomar foto"
            className="relative grid size-16 shrink-0 place-items-center rounded-full bg-[#10cfc9] text-[#043b39] shadow-[0_16px_36px_-14px_#10cfc9] transition active:scale-95 disabled:opacity-60"
          >
            <span className="animate-pulse-ring absolute inset-0 rounded-full border-2 border-[#10cfc9]" />
            {busy ? (
              <RefreshCcw size={24} className="animate-spin" />
            ) : (
              <ScanLine size={26} />
            )}
          </button>
        ) : (
          cameraState === "unavailable" && (
            <Button
              variant="outline"
              size="lg"
              onClick={() => window.location.reload()}
              className="shrink-0"
            >
              <RefreshCcw size={18} />
              Reintentar
            </Button>
          )
        )}
      </div>

      <p className="flex items-start gap-2 text-xs leading-5 text-slate-500">
        <ShieldCheck size={15} className="mt-0.5 shrink-0 text-[#0d9d99]" />
        La imagen se guarda en almacenamiento privado y se elimina automáticamente
        al cumplirse la política de retención de la empresa.
      </p>
    </div>
  );
}
