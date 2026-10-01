/** Utilidades de imagen para la captura de identificaciones en el teléfono. */

const MAX_DIMENSION = 1800;
const QUALITY = 0.82;

async function canvasToFile(
  canvas: HTMLCanvasElement,
  fileName: string,
): Promise<File> {
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", QUALITY),
  );
  if (!blob) throw new Error("No fue posible procesar la imagen");
  return new File([blob], fileName, {
    type: "image/jpeg",
    lastModified: Date.now(),
  });
}

/**
 * Reduce la imagen antes de subirla y de pasarla al OCR: menos datos en
 * tránsito, menos almacenamiento y un reconocimiento más rápido en el teléfono.
 */
export async function compressIdentityImage(
  file: File,
  maxDimension = MAX_DIMENSION,
): Promise<File> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);

  const context = canvas.getContext("2d");
  if (!context) {
    bitmap.close();
    throw new Error("No fue posible procesar la imagen");
  }
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  return canvasToFile(canvas, file.name.replace(/\.[^.]+$/, "") + ".jpg");
}

/** Toma un fotograma del video de la cámara y lo entrega ya comprimido. */
export async function captureFrame(
  video: HTMLVideoElement,
  maxDimension = MAX_DIMENSION,
  fileName = "identificacion",
): Promise<File> {
  const width = video.videoWidth;
  const height = video.videoHeight;
  if (!width || !height) throw new Error("La cámara aún no está lista");

  const scale = Math.min(1, maxDimension / Math.max(width, height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);

  const context = canvas.getContext("2d");
  if (!context) throw new Error("No fue posible capturar la imagen");
  context.drawImage(video, 0, 0, canvas.width, canvas.height);

  return canvasToFile(canvas, `${fileName}-${Date.now()}.jpg`);
}

/**
 * Recorta el fotograma al marco que el visitante ve en pantalla.
 * Sin este recorte el lector recibe la mesa, las manos y el fondo, y el
 * nombre de la credencial queda demasiado chico para leerse.
 */
export async function captureFramed(
  video: HTMLVideoElement,
  frame: HTMLElement | null,
  fileName = "identificacion",
): Promise<File> {
  const width = video.videoWidth;
  const height = video.videoHeight;
  if (!width || !height) throw new Error("La cámara aún no está lista");

  const view = video.getBoundingClientRect();
  const guide = frame?.getBoundingClientRect();
  let sx = 0;
  let sy = 0;
  let sw = width;
  let sh = height;

  if (guide && view.width > 0 && view.height > 0) {
    const cover = Math.max(view.width / width, view.height / height);
    const offsetX = (width * cover - view.width) / 2;
    const offsetY = (height * cover - view.height) / 2;
    const padX = guide.width * 0.06;
    const padY = guide.height * 0.06;
    sx = (guide.left - view.left - padX + offsetX) / cover;
    sy = (guide.top - view.top - padY + offsetY) / cover;
    sw = (guide.width + padX * 2) / cover;
    sh = (guide.height + padY * 2) / cover;
    sx = Math.max(0, Math.min(width - 1, sx));
    sy = Math.max(0, Math.min(height - 1, sy));
    sw = Math.max(1, Math.min(width - sx, sw));
    sh = Math.max(1, Math.min(height - sy, sh));
    if (sw < 80 || sh < 48) {
      sx = 0;
      sy = 0;
      sw = width;
      sh = height;
    }
  }

  let outW = sw;
  if (sw > MAX_DIMENSION) outW = MAX_DIMENSION;
  else if (sw < 1400) outW = Math.min(1400, Math.round(sw * 2));
  const outH = Math.max(1, Math.round(sh * (outW / sw)));

  const canvas = document.createElement("canvas");
  canvas.width = Math.round(outW);
  canvas.height = outH;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("No fue posible capturar la imagen");
  context.drawImage(video, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
  return canvasToFile(canvas, `${fileName}-${Date.now()}.jpg`);
}

/**
 * Prepara el reverso de la credencial para leer la banda MRZ.
 *
 * Recorta la franja inferior —donde la norma coloca los tres renglones—, la
 * amplía a una resolución cómoda para el reconocedor y la binariza. El OCR
 * mejora mucho con texto negro sobre blanco y sin el resto del diseño de la
 * credencial compitiendo por atención.
 */
export async function prepareMrzImage(
  file: File,
  { bandRatio = 0.42, targetWidth = 1600 } = {},
): Promise<Blob> {
  const bitmap = await createImageBitmap(file);

  const bandHeight = Math.round(bitmap.height * bandRatio);
  const bandTop = bitmap.height - bandHeight;
  const scale = targetWidth / bitmap.width;

  const canvas = document.createElement("canvas");
  canvas.width = targetWidth;
  canvas.height = Math.round(bandHeight * scale);

  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) {
    bitmap.close();
    throw new Error("No fue posible procesar la imagen");
  }

  context.drawImage(
    bitmap,
    0,
    bandTop,
    bitmap.width,
    bandHeight,
    0,
    0,
    canvas.width,
    canvas.height,
  );
  bitmap.close();

  // Escala de grises con umbral adaptativo simple: se calcula el promedio de
  // luminancia de la franja y se separa el texto del fondo respecto a él.
  const image = context.getImageData(0, 0, canvas.width, canvas.height);
  const pixels = image.data;
  const luminance = new Uint8ClampedArray(pixels.length / 4);

  let total = 0;
  for (let index = 0; index < luminance.length; index += 1) {
    const offset = index * 4;
    const value =
      pixels[offset] * 0.299 + pixels[offset + 1] * 0.587 + pixels[offset + 2] * 0.114;
    luminance[index] = value;
    total += value;
  }

  const threshold = (total / luminance.length) * 0.86;
  for (let index = 0; index < luminance.length; index += 1) {
    const offset = index * 4;
    const value = luminance[index] < threshold ? 0 : 255;
    pixels[offset] = value;
    pixels[offset + 1] = value;
    pixels[offset + 2] = value;
    pixels[offset + 3] = 255;
  }
  context.putImageData(image, 0, 0);

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/png"),
  );
  if (!blob) throw new Error("No fue posible preparar la imagen");
  return blob;
}

type CropRegion = { x: number; y: number; w: number; h: number };

async function cropRegions(
  bitmap: ImageBitmap,
  regions: CropRegion[],
  targetWidth: number,
) {
  const blobs: Blob[] = [];
  for (const region of regions) {
    const sx = Math.round(bitmap.width * region.x);
    const sy = Math.round(bitmap.height * region.y);
    const sw = Math.max(1, Math.round(bitmap.width * region.w));
    const sh = Math.max(1, Math.round(bitmap.height * region.h));
    const scale = targetWidth / sw;
    const canvas = document.createElement("canvas");
    canvas.width = targetWidth;
    canvas.height = Math.max(1, Math.round(sh * scale));
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) continue;

    context.drawImage(bitmap, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
    const image = context.getImageData(0, 0, canvas.width, canvas.height);
    const pixels = image.data;
    const luminance = new Uint8ClampedArray(pixels.length / 4);
    for (let index = 0; index < luminance.length; index += 1) {
      const offset = index * 4;
      luminance[index] =
        pixels[offset] * 0.299 +
        pixels[offset + 1] * 0.587 +
        pixels[offset + 2] * 0.114;
    }
    const sorted = Array.from(luminance).sort((a, b) => a - b);
    const low = sorted[Math.floor(sorted.length * 0.08)] ?? 0;
    const high = sorted[Math.floor(sorted.length * 0.92)] ?? 255;
    const span = Math.max(20, high - low);
    for (let index = 0; index < luminance.length; index += 1) {
      const offset = index * 4;
      const stretched = Math.min(
        255,
        Math.max(0, ((luminance[index] - low) / span) * 255),
      );
      pixels[offset] = stretched;
      pixels[offset + 1] = stretched;
      pixels[offset + 2] = stretched;
    }
    context.putImageData(image, 0, 0);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/png"),
    );
    if (blob) blobs.push(blob);
  }
  return blobs;
}

/**
 * Dos recortes de una credencial ya encuadrada: el bloque del nombre
 * (a la derecha de la foto, en el frente de la INE) y la credencial completa.
 */
export async function prepareIdentityCrops(file: File): Promise<Blob[]> {
  const bitmap = await createImageBitmap(file);
  const regions = [
    { x: 0.3, y: 0.05, w: 0.66, h: 0.5 },
    { x: 0.02, y: 0.02, w: 0.96, h: 0.96 },
  ];
  try {
    return await cropRegions(bitmap, regions, 1800);
  } finally {
    bitmap.close();
  }
}

/**
 * Recorta la franja central, donde queda la placa en el marco ancho, y
 * estira el contraste solo de esa franja. El auto completo aplana el número.
 */
export async function preparePlateCrops(file: File): Promise<Blob[]> {
  const bitmap = await createImageBitmap(file);
  const regions = [
    { x: 0.04, y: 0.12, w: 0.92, h: 0.76 },
    { x: 0.06, y: 0.28, w: 0.88, h: 0.44 },
  ];
  try {
    return await cropRegions(bitmap, regions, 1600);
  } finally {
    bitmap.close();
  }
}

export const ACCEPTED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "image/*",
];
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

export function validateImage(file: File) {
  const type = file.type.toLowerCase();
  const allowed = [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
    "image/heic",
    "image/heif",
    "application/octet-stream",
    "",
  ];
  if (type && !allowed.includes(type) && !type.startsWith("image/"))
    return "image_invalid";
  if (file.size > MAX_IMAGE_BYTES) return "image_too_large";
  return null;
}
