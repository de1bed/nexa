import { z } from "zod";
import { isExpired, readMrz } from "./mrz";
import type { OCRField, OCRResult } from "./types";

/** Campos que Gemini debe devolver al leer una credencial mexicana. */
export const extractedIdSchema = z.object({
  fullName: z
    .string()
    .nullable()
    .describe("Nombre completo como aparece en la credencial"),
  documentNumber: z
    .string()
    .nullable()
    .describe("Folio o número de la credencial, sin espacios"),
  birthDate: z
    .string()
    .nullable()
    .describe("Fecha de nacimiento en YYYY-MM-DD"),
  expiryDate: z
    .string()
    .nullable()
    .describe("Vigencia o fecha de vencimiento en YYYY-MM-DD"),
  curp: z.string().nullable().describe("CURP de 18 caracteres, si se ve"),
  address: z.string().nullable().describe("Domicilio, si se lee en el anverso"),
  mrzText: z
    .string()
    .nullable()
    .describe(
      "Los tres renglones de la banda MRZ del reverso, tal cual, con <",
    ),
  rawText: z
    .string()
    .describe("Todo el texto visible, anverso y reverso, en el orden leído"),
});

export type ExtractedId = z.infer<typeof extractedIdSchema>;

function clean(value: string | null | undefined) {
  const text = value?.replace(/\s+/g, " ").trim();
  return text ? text : undefined;
}

function toFields(result: OCRResult): OCRField[] {
  const confidence = result.mrz?.verified ? 100 : result.confidence;
  const fields: OCRField[] = [];
  if (result.fullName)
    fields.push({ name: "fullName", value: result.fullName, confidence });
  if (result.documentNumber)
    fields.push({
      name: "documentNumber",
      value: result.documentNumber,
      confidence:
        result.mrz?.checks.documentNumber === "valid" ? 100 : confidence,
    });
  if (result.birthDate)
    fields.push({
      name: "birthDate",
      value: result.birthDate,
      confidence: result.mrz?.checks.birthDate === "valid" ? 100 : confidence,
    });
  if (result.expiryDate)
    fields.push({
      name: "expiryDate",
      value: result.expiryDate,
      confidence: result.mrz?.checks.expiryDate === "valid" ? 100 : confidence,
    });
  if (result.curp)
    fields.push({ name: "curp", value: result.curp, confidence });
  if (result.address)
    fields.push({
      name: "address",
      value: result.address,
      confidence: Math.min(confidence, 80),
    });
  return fields;
}

/**
 * Combina la lectura visual con el MRZ. Si la banda cuadra, esos campos
 * ganan: no son una conjetura, son dígitos de control.
 */
export function ocrResultFromExtraction(extracted: ExtractedId): OCRResult {
  const rawText = [extracted.mrzText, extracted.rawText]
    .filter(Boolean)
    .join("\n")
    .trim();
  const mrz = readMrz(extracted.mrzText ?? "") ?? readMrz(rawText);

  const fullName =
    (mrz?.verified && mrz.fullName) ||
    clean(extracted.fullName) ||
    mrz?.fullName ||
    undefined;
  const documentNumber =
    (mrz?.verified && mrz.documentNumber) ||
    clean(extracted.documentNumber) ||
    mrz?.documentNumber ||
    undefined;
  const birthDate =
    (mrz?.checks.birthDate === "valid" && mrz.birthDate) ||
    clean(extracted.birthDate) ||
    mrz?.birthDate ||
    undefined;
  const expiryDate =
    (mrz?.checks.expiryDate === "valid" && mrz.expiryDate) ||
    clean(extracted.expiryDate) ||
    mrz?.expiryDate ||
    undefined;
  const curp = clean(extracted.curp) || mrz?.curp;
  const address = clean(extracted.address);

  const confidence = mrz
    ? mrz.verified
      ? 100
      : Math.max(mrz.confidence, fullName || documentNumber ? 72 : 0)
    : fullName || documentNumber
      ? 74
      : 0;

  const result: OCRResult = {
    fullName,
    documentNumber,
    birthDate,
    expiryDate,
    curp,
    address,
    rawText,
    confidence,
    fields: [],
    mrz: mrz ?? undefined,
    expired: mrz ? isExpired(mrz) : undefined,
  };
  result.fields = toFields(result);
  return result;
}
