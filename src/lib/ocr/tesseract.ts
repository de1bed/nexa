import type { OCRField, OCRImageInput, OCRProvider, OCRResult } from "./types";
import { isExpired, readMrz, type MrzResult } from "./mrz";
import { prepareMrzImage } from "@/lib/image";

function lastImage(image: OCRImageInput) {
  return Array.isArray(image) ? image[image.length - 1] : image;
}

/**
 * Reconocimiento local con Tesseract, afinado para la banda MRZ del reverso.
 *
 * La imagen nunca sale del dispositivo del visitante: el motor corre en
 * WebAssembly dentro del navegador. Los archivos del motor se sirven desde
 * `/tesseract` (ver `npm run setup:ocr`), no desde un CDN externo, para que la
 * política de seguridad de contenido pueda seguir siendo estricta.
 *
 * Se prioriza el MRZ sobre el anverso porque trae dígitos de control: permite
 * **comprobar** que la lectura fue correcta en vez de confiar en ella.
 */

const ASSET_BASE = process.env.NEXT_PUBLIC_TESSERACT_ASSETS ?? "/tesseract";

/** Alfabeto de la norma ICAO 9303: sin minúsculas, signos ni acentos. */
const MRZ_CHARSET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789<";

type Worker = Awaited<ReturnType<typeof createMrzWorker>>;

async function createMrzWorker() {
  const { createWorker, PSM } = await import("tesseract.js");

  const worker = await createWorker("eng", 1, {
    workerPath: `${ASSET_BASE}/worker.min.js`,
    corePath: `${ASSET_BASE}/core`,
    langPath: `${ASSET_BASE}/lang`,
    gzip: true,
  });

  await worker.setParameters({
    tessedit_char_whitelist: MRZ_CHARSET,
    // La banda es un bloque uniforme de texto monoespaciado.
    tessedit_pageseg_mode: PSM.SINGLE_BLOCK,
    // El diccionario estorba: el MRZ no contiene palabras.
    load_system_dawg: "0",
    load_freq_dawg: "0",
    preserve_interword_spaces: "1",
  });

  return worker;
}

function toFields(mrz: MrzResult): OCRField[] {
  const confidence = mrz.verified ? 100 : mrz.confidence;
  const fields: OCRField[] = [];

  if (mrz.fullName)
    fields.push({ name: "fullName", value: mrz.fullName, confidence });
  if (mrz.documentNumber)
    fields.push({
      name: "documentNumber",
      value: mrz.documentNumber,
      confidence:
        mrz.checks.documentNumber === "valid" ? 100 : mrz.confidence,
    });
  if (mrz.birthDate)
    fields.push({
      name: "birthDate",
      value: mrz.birthDate,
      confidence: mrz.checks.birthDate === "valid" ? 100 : mrz.confidence,
    });
  if (mrz.expiryDate)
    fields.push({
      name: "expiryDate",
      value: mrz.expiryDate,
      confidence: mrz.checks.expiryDate === "valid" ? 100 : mrz.confidence,
    });
  if (mrz.curp) fields.push({ name: "curp", value: mrz.curp, confidence });

  return fields;
}

export class TesseractOCRProvider implements OCRProvider {
  readonly name = "tesseract";

  async extractIdentityData(image: OCRImageInput): Promise<OCRResult> {
    const target = lastImage(image);
    let worker: Worker | null = null;

    try {
      worker = await createMrzWorker();

      // Primer intento: solo la franja inferior, binarizada.
      let rawText = "";
      let mrz: MrzResult | null = null;

      if (target instanceof File) {
        const band = await prepareMrzImage(target).catch(() => null);
        if (band) {
          const { data } = await worker.recognize(band);
          rawText = data.text ?? "";
          mrz = readMrz(rawText);
        }
      }

      // Segundo intento: la imagen completa, por si el encuadre dejó la banda
      // fuera de la franja esperada.
      if (!mrz) {
        const { data } = await worker.recognize(target as Blob);
        rawText = `${rawText}\n${data.text ?? ""}`.trim();
        mrz = readMrz(rawText);
      }

      if (!mrz)
        return {
          rawText,
          confidence: 0,
          fields: [],
        };

      return {
        fullName: mrz.fullName || undefined,
        documentNumber: mrz.documentNumber || undefined,
        birthDate: mrz.birthDate,
        expiryDate: mrz.expiryDate,
        curp: mrz.curp,
        rawText,
        confidence: mrz.verified ? 100 : mrz.confidence,
        fields: toFields(mrz),
        mrz,
        expired: isExpired(mrz),
      };
    } finally {
      await worker?.terminate().catch(() => undefined);
    }
  }
}
