import type { OCRProvider, OCRResult } from "./types";

function asList(image: File | Blob | Array<File | Blob>) {
  return Array.isArray(image) ? image : [image];
}

/**
 * Llama al lector del servidor (Gemini vía AI Gateway) y, si no responde,
 * cae a Tesseract en el dispositivo para no bloquear al visitante.
 */
export class CloudOCRProvider implements OCRProvider {
  readonly name = "gemini";

  async extractIdentityData(
    image: File | Blob | Array<File | Blob>,
  ): Promise<OCRResult> {
    const files = asList(image);
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
      // Sin red o sin cupo del proveedor: el motor local sigue siendo útil.
    }

    const { TesseractOCRProvider } = await import("./tesseract");
    return new TesseractOCRProvider().extractIdentityData(files.at(-1)!);
  }
}
