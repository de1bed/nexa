import type { OCRProvider } from "./types";
import { MockOCRProvider } from "./mock";
import { isLiveMode } from "@/lib/config";

/**
 * La lectura corre en el teléfono con Tesseract. No llama a un modelo de pago.
 * El mock solo existe en la vitrina, sin credenciales.
 */
export async function getOCRProvider(): Promise<OCRProvider> {
  const forced = process.env.NEXT_PUBLIC_OCR_PROVIDER;
  if (forced === "mock" || !isLiveMode()) return new MockOCRProvider();
  const { TesseractOCRProvider } = await import("./tesseract");
  return new TesseractOCRProvider();
}

export { LOW_CONFIDENCE, OCR_DISCLAIMER } from "./types";
export type { OCRResult, OCRField, OCRProvider } from "./types";
export { isExpired, readMrz } from "./mrz";
export type { MrzResult } from "./mrz";
