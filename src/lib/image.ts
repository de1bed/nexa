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

  return canvasToFile(canvas, `identificacion-${Date.now()}.jpg`);
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

export const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

export function validateImage(file: File) {
  if (!ACCEPTED_IMAGE_TYPES.includes(file.type))
    return "Usa una imagen JPG, PNG o WebP.";
  if (file.size > MAX_IMAGE_BYTES) return "La imagen supera el límite de 8 MB.";
  return null;
}
