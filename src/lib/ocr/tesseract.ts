import type { OCRField, OCRImageInput, OCRProvider, OCRResult } from "./types";
import { pickPrintedIdentity } from "./card-text";
import { isExpired, readMrz, type MrzResult } from "./mrz";
import { pickPlate } from "./plate";
import { prepareMrzImage, preparePlateCrops } from "@/lib/image";

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
const PLATE_CHARSET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

const workerOptions = {
  workerPath: `${ASSET_BASE}/worker.min.js`,
  corePath: `${ASSET_BASE}/core`,
  langPath: `${ASSET_BASE}/lang`,
  gzip: true,
};

async function openWorker() {
  const { createWorker } = await import("tesseract.js");
  try {
    return await createWorker("spa+eng", 1, workerOptions);
  } catch {
    return await createWorker("eng", 1, workerOptions);
  }
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

/** Lee una placa en el teléfono. Devuelve null si no aparece un patrón claro. */
export async function readPlateText(file: File) {
  const { createWorker, PSM } = await import("tesseract.js");
  const worker = await createWorker("eng", 1, workerOptions);

  try {
    await worker.setParameters({
      tessedit_char_whitelist: PLATE_CHARSET,
      tessedit_pageseg_mode: PSM.SINGLE_LINE,
      load_system_dawg: "0",
      load_freq_dawg: "0",
    });

    const crops = await preparePlateCrops(file).catch(() => []);
    const images: Array<Blob | File> = crops.length > 0 ? crops : [file];
    let combined = "";
    for (const image of images) {
      const read = await worker.recognize(image);
      combined = `${combined}\n${read.data.text ?? ""}`;
      const hit = pickPlate(combined);
      if (hit) return hit;
    }

    await worker.setParameters({
      tessedit_pageseg_mode: PSM.SINGLE_BLOCK,
    });
    const again = await worker.recognize(images[0] ?? file);
    return pickPlate(`${combined}\n${again.data.text ?? ""}`);
  } finally {
    await worker.terminate().catch(() => undefined);
  }
}

export class TesseractOCRProvider implements OCRProvider {
  readonly name = "tesseract";

  async extractIdentityData(image: OCRImageInput): Promise<OCRResult> {
    const target = lastImage(image);
    const { PSM } = await import("tesseract.js");
    const worker = await openWorker();

    try {
      await worker.setParameters({
        tessedit_pageseg_mode: PSM.AUTO,
        preserve_interword_spaces: "1",
      });

      const page = await worker.recognize(target as Blob);
      let rawText = page.data.text ?? "";
      const printed = pickPrintedIdentity(rawText);

      let mrz: MrzResult | null = null;
      if (target instanceof File) {
        const band = await prepareMrzImage(target).catch(() => null);
        if (band) {
          await worker.setParameters({
            tessedit_char_whitelist: MRZ_CHARSET,
            tessedit_pageseg_mode: PSM.SINGLE_BLOCK,
            load_system_dawg: "0",
            load_freq_dawg: "0",
          });
          const bandRead = await worker.recognize(band);
          const bandText = bandRead.data.text ?? "";
          rawText = `${rawText}\n${bandText}`.trim();
          mrz = readMrz(bandText);
        }
      }

      const fullName =
        (mrz?.verified && mrz.fullName) || printed.fullName || mrz?.fullName || undefined;
      const documentNumber =
        printed.documentNumber ||
        (mrz?.documentNumber && mrz.checks.documentNumber === "valid"
          ? mrz.documentNumber
          : undefined) ||
        mrz?.curp ||
        printed.curp;

      if (!fullName && !documentNumber && !mrz)
        return { rawText, confidence: 0, fields: [] };

      const confidence = mrz?.verified ? 100 : fullName ? 85 : 60;
      return {
        fullName,
        documentNumber,
        birthDate: mrz?.birthDate,
        expiryDate: mrz?.expiryDate,
        curp: mrz?.curp || printed.curp,
        rawText,
        confidence,
        fields: mrz ? toFields(mrz) : [],
        mrz: mrz ?? undefined,
        expired: mrz ? isExpired(mrz) : undefined,
      };
    } finally {
      await worker.terminate().catch(() => undefined);
    }
  }
}
