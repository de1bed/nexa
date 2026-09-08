import { NextResponse } from "next/server";
import { rateLimit, requestOrigin } from "@/lib/server/rate-limit";
import {
  extractIdentityFromImages,
  visionOcrConfigured,
} from "@/lib/server/vision-ocr";
import { identityFileMeta, isAllowedIdentityUpload } from "@/lib/identity-file";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

async function readSide(form: FormData, name: string) {
  const value = form.get(name);
  if (!(value instanceof File) || value.size === 0) return null;
  if (!isAllowedIdentityUpload(value)) return "invalid" as const;
  const { mimeType } = identityFileMeta(value);
  return {
    bytes: new Uint8Array(await value.arrayBuffer()),
    mimeType,
  };
}

export async function POST(request: Request) {
  const limit = rateLimit(`ocr:${requestOrigin(request)}`, 10, 300000);
  if (!limit.allowed)
    return NextResponse.json(
      { error: "Demasiados intentos. Espera unos minutos." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter) } },
    );

  if (!visionOcrConfigured())
    return NextResponse.json(
      { error: "El lector en la nube no está configurado" },
      { status: 503 },
    );

  try {
    const form = await request.formData();
    const front = await readSide(form, "front");
    const back = await readSide(form, "back");
    if (front === "invalid" || back === "invalid")
      return NextResponse.json(
        { error: "Las imágenes deben ser JPG, PNG o WebP" },
        { status: 400 },
      );

    const images: Array<{ bytes: Uint8Array; mimeType: string }> = [];
    if (front && front !== "invalid") images.push(front);
    if (back && back !== "invalid") images.push(back);
    if (images.length === 0)
      return NextResponse.json(
        { error: "Falta la foto de la identificación" },
        { status: 400 },
      );

    const result = await extractIdentityFromImages(images);
    return NextResponse.json(result, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("OCR failed", error);
    return NextResponse.json(
      { error: "No fue posible leer la identificación" },
      { status: 502 },
    );
  }
}
