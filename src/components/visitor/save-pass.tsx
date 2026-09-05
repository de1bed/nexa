"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Check, Download, Loader2, Share2 } from "lucide-react";
import { Button } from "../ui";
import { Sheet } from "../ui-client";

/**
 * Genera una imagen del pase y la guarda en el teléfono (descarga / compartir
 * a Fotos). El QR se dibuja en un canvas: no depende de capturar el DOM.
 */
export function SavePassButton({
  token,
  visitorName,
  organizationName,
  hostName,
  location,
  startsAt,
  promptOnMount = false,
}: {
  token: string;
  visitorName: string;
  organizationName?: string;
  hostName: string;
  location: string;
  startsAt: string;
  promptOnMount?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [prompt, setPrompt] = useState(false);

  useEffect(() => {
    if (!promptOnMount || typeof window === "undefined") return;
    const key = `nexa-pass-saved:${token}`;
    if (sessionStorage.getItem(key)) return;
    const timer = window.setTimeout(() => setPrompt(true), 600);
    return () => window.clearTimeout(timer);
  }, [promptOnMount, token]);

  async function renderFile() {
    const when = new Intl.DateTimeFormat("es-MX", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(startsAt));
    const qr = await QRCode.toDataURL(token, {
      width: 640,
      margin: 1,
      errorCorrectionLevel: "M",
      color: { dark: "#071426", light: "#ffffff" },
    });

    const width = 720;
    const height = 980;
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("canvas");

    ctx.fillStyle = "#071426";
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = "#10cfc9";
    ctx.font = "600 22px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("PASE DE ACCESO", width / 2, 64);
    ctx.fillStyle = "#ffffff";
    ctx.font = "600 34px system-ui, sans-serif";
    ctx.fillText(organizationName || "NEXA VISIT", width / 2, 112);

    const image = await loadImage(qr);
    const qrSize = 420;
    const qrX = (width - qrSize) / 2;
    ctx.fillStyle = "#ffffff";
    roundRect(ctx, qrX - 18, 150, qrSize + 36, qrSize + 36, 28);
    ctx.fill();
    ctx.drawImage(image, qrX, 168, qrSize, qrSize);

    ctx.fillStyle = "#ffffff";
    ctx.font = "600 36px system-ui, sans-serif";
    ctx.fillText(visitorName, width / 2, 660);
    ctx.fillStyle = "#94a3b8";
    ctx.font = "22px system-ui, sans-serif";
    ctx.fillText(hostName, width / 2, 704);
    ctx.fillText(location, width / 2, 740);
    ctx.fillText(when, width / 2, 776);
    ctx.fillStyle = "#10cfc9";
    ctx.font = "600 16px system-ui, sans-serif";
    ctx.fillText("Guárdalo. Lo vas a necesitar en recepción.", width / 2, 860);

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (value) => (value ? resolve(value) : reject(new Error("blob"))),
        "image/png",
      );
    });
    return new File([blob], `pase-nexa-visit.png`, { type: "image/png" });
  }

  async function save() {
    setBusy(true);
    try {
      const file = await renderFile();
      const shared = await shareFile(file);
      if (!shared) downloadFile(file);
      setSaved(true);
      sessionStorage.setItem(`nexa-pass-saved:${token}`, "1");
      setPrompt(false);
    } catch {
      setSaved(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button
        variant={saved ? "outline" : "accent"}
        size="lg"
        block
        disabled={busy}
        onClick={() => void save()}
      >
        {busy ? (
          <Loader2 size={18} className="animate-spin" />
        ) : saved ? (
          <>
            <Check size={18} />
            Pase guardado
          </>
        ) : (
          <>
            <Download size={18} />
            Guardar pase
          </>
        )}
      </Button>

      <Sheet
        open={prompt}
        onClose={() => setPrompt(false)}
        title="Guarda este pase"
        description="Si cierras esta pantalla y no lo tienes, tendrás que pedírselo a tu anfitrión. Guárdalo en Fotos ahora."
      >
        <Button variant="accent" size="lg" block disabled={busy} onClick={() => void save()}>
          {busy ? (
            <Loader2 size={18} className="animate-spin" />
          ) : (
            <>
              <Share2 size={18} />
              Guardar en el teléfono
            </>
          )}
        </Button>
        <button
          type="button"
          className="mt-3 w-full py-3 text-sm font-medium text-slate-500"
          onClick={() => setPrompt(false)}
        >
          Ahora no
        </button>
      </Sheet>
    </>
  );
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("image"));
    image.src = src;
  });
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

async function shareFile(file: File) {
  const nav = navigator as Navigator & {
    canShare?: (data: ShareData) => boolean;
  };
  if (!nav.share || !nav.canShare?.({ files: [file] })) return false;
  try {
    await nav.share({
      files: [file],
      title: "Pase NEXA VISIT",
      text: "Guarda este pase. Lo vas a mostrar en recepción.",
    });
    return true;
  } catch (reason) {
    if (reason instanceof DOMException && reason.name === "AbortError")
      return true;
    return false;
  }
}

function downloadFile(file: File) {
  const url = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.href = url;
  link.download = file.name;
  link.click();
  URL.revokeObjectURL(url);
}
