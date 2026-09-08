import "server-only";
import { generateText, Output } from "ai";
import {
  extractedIdSchema,
  ocrResultFromExtraction,
} from "@/lib/ocr/extraction";
import type { OCRResult } from "@/lib/ocr/types";

const DEFAULT_MODEL = "google/gemini-2.5-flash";

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
export async function extractIdentityFromImages(
  images: Array<{ bytes: Uint8Array; mimeType: string }>,
): Promise<OCRResult> {
  const model = process.env.OCR_MODEL?.trim() || DEFAULT_MODEL;
  const { output } = await generateText({
    model,
    instructions:
      "Eres un lector de identificaciones mexicanas (INE/IFE, pasaporte). " +
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
              "fechas, CURP, domicilio y la banda MRZ si aparece.",
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
