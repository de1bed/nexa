import type { OCRProvider } from "./types";
import { MockOCRProvider } from "./mock";
import { isLiveMode } from "@/lib/config";

/**
 * En vivo: Tesseract en el teléfono y, si falta el nombre o el folio, la nube.
 * NEXT_PUBLIC_OCR_PROVIDER=tesseract deja solo el teléfono.
 * El mock solo existe en la vitrina, sin credenciales.
 */
export async function getOCRProvider(): Promise<OCRProvider> {
  const forced = process.env.NEXT_PUBLIC_OCR_PROVIDER;
  if (forced === "mock" || !isLiveMode()) return new MockOCRProvider();
  if (forced === "tesseract") {
    const { TesseractOCRProvider } = await import("./tesseract");
    return new TesseractOCRProvider();
  }
  const { CloudOCRProvider } = await import("./cloud");
  return new CloudOCRProvider();
}

export { LOW_CONFIDENCE, OCR_DISCLAIMER } from "./types";
export type { OCRResult, OCRField, OCRProvider } from "./types";
export { isExpired, readMrz } from "./mrz";
export type { MrzResult } from "./mrz";
