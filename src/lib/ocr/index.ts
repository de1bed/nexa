import type { OCRProvider } from "./types";
import { MockOCRProvider } from "./mock";

/**
 * Selección del proveedor de OCR.
 *
 * `NEXT_PUBLIC_OCR_PROVIDER=tesseract` activa el reconocimiento real de la
 * banda MRZ, que corre en el dispositivo del visitante. El paquete se carga
 * bajo demanda para no penalizar la primera pantalla, y requiere haber
 * ejecutado `npm run setup:ocr`. Cualquier otro valor usa el proveedor
 * reproducible, que devuelve una banda bien formada de ejemplo.
 */
export async function getOCRProvider(): Promise<OCRProvider> {
  if (process.env.NEXT_PUBLIC_OCR_PROVIDER === "tesseract") {
    const { TesseractOCRProvider } = await import("./tesseract");
    return new TesseractOCRProvider();
  }
  return new MockOCRProvider();
}

export { LOW_CONFIDENCE, OCR_DISCLAIMER } from "./types";
export type { OCRResult, OCRField, OCRProvider } from "./types";
export { isExpired, readMrz } from "./mrz";
export type { MrzResult } from "./mrz";
