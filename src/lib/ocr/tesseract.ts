import type { OCRField, OCRImageInput, OCRProvider, OCRResult } from "./types";
import { pickPrintedIdentity } from "./card-text";
import { isExpired, readMrz, type MrzResult } from "./mrz";
import { pickPlate } from "./plate";
import {
  prepareIdentityCrops,
  prepareMrzImage,
  preparePlateCrops,
} from "@/lib/image";

function lastImage(image: OCRImageInput) {
  return Array.isArray(image) ? image[image.length - 1] : image;
}

/**
 * Lectura en el teléfono, sin servicio de pago.
 *
 * El motor se carga como worker del mismo sitio (`workerBlobURL: false`).
 * El atajo por blob falla en Safari y el reconocimiento no llega a correr:
 * el nombre y la placa se quedan vacíos aunque la foto sí se guardó.
 *
 * Un solo worker en inglés, reutilizado. Cargar español junto con inglés
 * duplica la descarga y, si falla, la promesa de arranque no se resuelve.
 */

const ASSET_BASE = process.env.NEXT_PUBLIC_TESSERACT_ASSETS ?? "/tesseract";
const MRZ_CHARSET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789<";
const PLATE_CHARSET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
const TEXT_CHARSET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyzÁÉÍÓÚÜÑáéíóúüñ0123456789 ";

type OcrPhase = "prepare" | "read";
type StatusSink = (phase: OcrPhase, progress: number) => void;

let statusSink: StatusSink | null = null;

export function setOcrStatusSink(sink: StatusSink | null) {
  statusSink = sink;
}

const workerOptions = {
  workerPath: `${ASSET_BASE}/worker.min.js`,
  corePath: `${ASSET_BASE}/core`,
  langPath: `${ASSET_BASE}/lang`,
  gzip: true,
  workerBlobURL: false,
  logger(message: { status?: string; progress?: number }) {
    const status = message.status ?? "";
    if (!statusSink || !status) return;
    if (status === "recognizing text") statusSink("read", message.progress ?? 0);
    else statusSink("prepare", message.progress ?? 0);
  },
};

type Engine = Awaited<ReturnType<typeof import("tesseract.js").createWorker>>;

let enginePromise: Promise<Engine> | null = null;
let queue: Promise<unknown> = Promise.resolve();

function withTimeout<T>(promise: Promise<T>, ms: number) {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("ocr-timeout")), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error instanceof Error ? error : new Error("ocr-failed"));
      },
    );
  });
}

function enqueue<T>(job: () => Promise<T>) {
  const run = queue.then(job, job);
  queue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

async function discardEngine() {
  const pending = enginePromise;
  enginePromise = null;
  if (!pending) return;
  const engine = await pending.catch(() => null);
  await engine?.terminate().catch(() => undefined);
}

async function getEngine() {
  if (!enginePromise) {
    enginePromise = (async () => {
      const { createWorker } = await import("tesseract.js");
      return withTimeout(createWorker("eng", 1, workerOptions), 90000);
    })().catch((error) => {
      enginePromise = null;
      throw error;
    });
  }
  return enginePromise;
}

function readText(result: { data?: { text?: string } }) {
  return result.data?.text ?? "";
}

async function configure(
  engine: Engine,
  params: Parameters<Engine["setParameters"]>[0],
) {
  try {
    await engine.setParameters(params);
  } catch {
    const rest = { ...params };
    delete rest.tessedit_char_whitelist;
    await engine.setParameters(rest);
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
  return enqueue(async () => {
    const { PSM } = await import("tesseract.js");
    const engine = await getEngine();
    try {
      const crops = await preparePlateCrops(file).catch(() => []);
      const images: Array<Blob | File> = [...crops, file];
      let combined = "";

      for (const [index, image] of images.entries()) {
        await configure(engine, {
          tessedit_char_whitelist: PLATE_CHARSET,
          tessedit_pageseg_mode:
            index === 0 ? PSM.SINGLE_BLOCK : PSM.SINGLE_LINE,
          load_system_dawg: "0",
          load_freq_dawg: "0",
        });
        const read = await withTimeout(engine.recognize(image), 25000);
        combined = `${combined}\n${readText(read)}`;
        const hit = pickPlate(combined);
        if (hit) return hit;
      }
      return pickPlate(combined);
    } catch (error) {
      await discardEngine();
      throw error;
    }
  });
}

export class TesseractOCRProvider implements OCRProvider {
  readonly name = "tesseract";

  async extractIdentityData(image: OCRImageInput): Promise<OCRResult> {
    const target = lastImage(image);
    return enqueue(async () => {
      const { PSM } = await import("tesseract.js");
      const engine = await getEngine();
      try {
        const crops =
          target instanceof File
            ? await prepareIdentityCrops(target).catch(() => [])
            : [];
        const images: Array<Blob | File> =
          crops.length > 0 ? crops : [target as Blob];

        let rawText = "";
        let printed = pickPrintedIdentity("");
        for (const sample of images) {
          await configure(engine, {
            tessedit_char_whitelist: TEXT_CHARSET,
            tessedit_pageseg_mode: PSM.SPARSE_TEXT,
            preserve_interword_spaces: "1",
          });
          const page = await withTimeout(engine.recognize(sample), 30000);
          rawText = `${rawText}\n${readText(page)}`.trim();
          printed = pickPrintedIdentity(rawText);
          if (printed.fullName) break;
        }

        let mrz: MrzResult | null = null;
        if (target instanceof File && !printed.documentNumber) {
          const band = await prepareMrzImage(target).catch(() => null);
          if (band) {
            await configure(engine, {
              tessedit_char_whitelist: MRZ_CHARSET,
              tessedit_pageseg_mode: PSM.SINGLE_BLOCK,
              load_system_dawg: "0",
              load_freq_dawg: "0",
            });
            const bandRead = await withTimeout(engine.recognize(band), 20000);
            const bandText = readText(bandRead);
            rawText = `${rawText}\n${bandText}`.trim();
            mrz = readMrz(bandText);
          }
        }

        const fullName =
          (mrz?.verified && mrz.fullName) ||
          printed.fullName ||
          mrz?.fullName ||
          undefined;
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
      } catch (error) {
        await discardEngine();
        throw error;
      }
    });
  }
}
