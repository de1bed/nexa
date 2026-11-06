import "server-only";
import { generateText, Output } from "ai";
import {
  extractedIdSchema,
  ocrResultFromExtraction,
} from "@/lib/ocr/extraction";
import type { OCRResult } from "@/lib/ocr/types";

const DEFAULT_MODEL = "google/gemini-2.5-flash-lite";

export function visionOcrConfigured() {
  return (
    process.env.VERCEL === "1" ||
    Boolean(process.env.AI_GATEWAY_API_KEY) ||
    Boolean(process.env.GOOGLE_GENERATIVE_AI_API_KEY)
  );
}

/**
 * Lee anverso y/o reverso de una credencial mexicana con Gemini
 * (Vercel AI Gateway). El MRZ se revalida en local con dígitos de control.
 */
/** Qué es el «folio» en cada identificación aceptada. */
function folioGuide(documentType?: string) {
  const type = (documentType ?? "").toLowerCase();
  if (type.includes("pasaporte"))
    return "Es un pasaporte: el folio es el número de pasaporte (renglón 2 del MRZ, 9 caracteres).";
  if (type.includes("licencia"))
    return "Es una licencia de conducir: el folio es el número de licencia impreso en el frente.";
  if (type.includes("ine") || type.includes("ife"))
    return "Es una credencial INE/IFE: el folio es el número del reverso que va después de IDMEX en el MRZ; si no se lee, la clave de elector del frente.";
  return "Puede ser INE/IFE, licencia de conducir o pasaporte.";
}

export async function extractIdentityFromImages(
  images: Array<{ bytes: Uint8Array; mimeType: string }>,
  documentType?: string,
): Promise<OCRResult> {
  const model = process.env.OCR_MODEL?.trim() || DEFAULT_MODEL;
  const { output } = await generateText({
    model,
    providerOptions: {
      google: { thinkingConfig: { thinkingBudget: 0 } },
    },
    instructions:
      "Eres un lector de identificaciones (INE/IFE, licencia de conducir, pasaporte). " +
      "Extrae solo lo que se ve. No inventes folios, CURP ni fechas. " +
      "Si un dato no se lee, déjalo null. Copia la banda MRZ del reverso " +
      "con los caracteres < tal cual.",
    output: Output.object({
      name: "MexicanId",
      description: "Datos leídos de una credencial mexicana",
      schema: extractedIdSchema,
    }),
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text:
              "Lee esta identificación. Si hay dos fotos, la primera es el " +
              "frente y la segunda el reverso. Devuelve nombre, folio, " +
              "fechas, CURP, domicilio y la banda MRZ si aparece. " +
              folioGuide(documentType),
          },
          ...images.map((image) => ({
            type: "file" as const,
            mediaType: image.mimeType,
            data: image.bytes,
          })),
        ],
      },
    ],
  });

  if (!output) throw new Error("El lector no devolvió datos");
  return ocrResultFromExtraction(output);
}
