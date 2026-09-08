import type { OCRProvider, OCRResult } from "./types";

function asList(image: File | Blob | Array<File | Blob>) {
  return Array.isArray(image) ? image : [image];
}

/**
 * Primero Tesseract (gratis, en el teléfono). Solo si la banda no cuadra
 * se llama a Gemini Flash Lite. Así la mayoría de INE recientes no cobran.
 */
export class CloudOCRProvider implements OCRProvider {
  readonly name = "gemini";

  async extractIdentityData(
    image: File | Blob | Array<File | Blob>,
  ): Promise<OCRResult> {
    const files = asList(image);
    const local = await this.readLocal(files.at(-1)!);
    if (local?.mrz?.verified) return local;

    const remote = await this.readRemote(files);
    return remote ?? local ?? { rawText: "", confidence: 0, fields: [] };
  }

  private async readLocal(image: File | Blob) {
    try {
      const { TesseractOCRProvider } = await import("./tesseract");
      return await new TesseractOCRProvider().extractIdentityData(image);
    } catch {
      return null;
    }
  }

  private async readRemote(files: Array<File | Blob>) {
    const form = new FormData();
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
