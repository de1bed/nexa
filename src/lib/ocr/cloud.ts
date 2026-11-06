import type { OCRHint, OCRProvider, OCRResult } from "./types";

/**
 * Si el teléfono ya leyó nombre y folio, no se llama a la nube.
 * Si falta uno de los dos, la nube completa lo que el teléfono no alcanzó.
 */
export function mergeIdentityRead(
  local: OCRResult | null,
  remote: OCRResult | null,
): OCRResult {
  const empty: OCRResult = { rawText: "", confidence: 0, fields: [] };
  if (!remote) return local ?? empty;
  if (!local) return remote;
  if (local.fullName && local.documentNumber) return local;
  const fullName = remote.fullName || local.fullName;
  const documentNumber = remote.documentNumber || local.documentNumber;
  return {
    ...remote,
    fullName,
    documentNumber,
    birthDate: remote.birthDate || local.birthDate,
    expiryDate: remote.expiryDate || local.expiryDate,
    curp: remote.curp || local.curp,
    address: remote.address || local.address,
    rawText: [local.rawText, remote.rawText].filter(Boolean).join("\n"),
    confidence: Math.max(local.confidence ?? 0, remote.confidence ?? 0),
    mrz: remote.mrz ?? local.mrz,
  };
}

function asList(image: File | Blob | Array<File | Blob>) {
  return Array.isArray(image) ? image : [image];
}

/**
 * Primero Tesseract (gratis, en el teléfono). Si falta el nombre o el folio
 * se llama a Gemini Flash Lite y se completa lo que el teléfono no leyó.
 */
export class CloudOCRProvider implements OCRProvider {
  readonly name = "gemini";

  async extractIdentityData(
    image: File | Blob | Array<File | Blob>,
    hint?: OCRHint,
  ): Promise<OCRResult> {
    const files = asList(image);
    const local = await this.readLocal(files);
    if (local?.fullName && local.documentNumber) return local;

    const remote = await this.readRemote(files, hint);
    return mergeIdentityRead(local, remote);
  }

  private async readLocal(image: Array<File | Blob>) {
    try {
      const { TesseractOCRProvider } = await import("./tesseract");
      return await new TesseractOCRProvider().extractIdentityData(image);
    } catch {
      return null;
    }
  }

  private async readRemote(files: Array<File | Blob>, hint?: OCRHint) {
    const form = new FormData();
    if (hint?.documentType) form.set("documentType", hint.documentType);
    if (files[0]) form.set("front", files[0]);
    if (files[1]) form.set("back", files[1]);
    else if (files[0]) form.set("back", files[0]);

    try {
      const response = await fetch("/api/public/ocr", {
        method: "POST",
        body: form,
      });
      if (response.ok) return (await response.json()) as OCRResult;
    } catch {
      // Sin cupo o sin red: nos quedamos con lo que leyó el teléfono.
    }
    return null;
  }
}
