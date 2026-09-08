import type { OCRProvider } from "./types";
import { MockOCRProvider } from "./mock";
import { isLiveMode } from "@/lib/config";

/**
 * En producción se lee con Gemini (AI Gateway) y, si falla, Tesseract.
 * El mock solo vive en la vitrina o si se fuerza explícitamente.
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
