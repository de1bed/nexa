/**
 * Prepara los archivos del motor de OCR para servirlos desde el propio dominio.
 *
 * Por defecto, tesseract.js descarga su motor WebAssembly y el modelo de idioma
 * desde un CDN externo. Eso choca con la política de seguridad de contenido de
 * la aplicación (`connect-src 'self'`) y además haría viajar cada carga fuera
 * de nuestra infraestructura. Copiando todo a `public/tesseract` el navegador
 * lo obtiene del mismo origen y no hace falta abrir la CSP.
 *
 *   npm run setup:ocr
 *
 * Es idempotente: lo que ya está descargado no se vuelve a bajar.
 */
import { createWriteStream } from "node:fs";
import { copyFile, mkdir, readdir, stat } from "node:fs/promises";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const target = path.join(root, "public", "tesseract");

/** El MRZ es ASCII en tipografía OCR-B: el modelo inglés lo lee mejor que el español. */
const LANGUAGES = ["eng"];
const TESSDATA_BASE = "https://tessdata.projectnaptha.com/4.0.0";

async function exists(file) {
  try {
    const info = await stat(file);
    return info.size > 0;
  } catch {
    return false;
  }
}

async function copyWorker() {
  const from = path.join(root, "node_modules", "tesseract.js", "dist", "worker.min.js");
  if (!(await exists(from))) throw new Error("Falta tesseract.js en node_modules");
  await copyFile(from, path.join(target, "worker.min.js"));
  return 1;
}

async function copyCore() {
  const from = path.join(root, "node_modules", "tesseract.js-core");
  const to = path.join(target, "core");
  await mkdir(to, { recursive: true });

  const entries = await readdir(from);
  // Solo el runtime: los .js cargadores y sus binarios WebAssembly.
  const needed = entries.filter(
    (name) => name.endsWith(".wasm") || name.endsWith(".wasm.js") || name.endsWith(".js"),
  );
  await Promise.all(
    needed.map((name) => copyFile(path.join(from, name), path.join(to, name))),
  );
  return needed.length;
}

async function downloadLanguages() {
  const to = path.join(target, "lang");
  await mkdir(to, { recursive: true });

  let downloaded = 0;
  for (const language of LANGUAGES) {
    const file = path.join(to, `${language}.traineddata.gz`);
    if (await exists(file)) {
      console.log(`  · ${language}.traineddata.gz ya estaba`);
      continue;
    }

    const url = `${TESSDATA_BASE}/${language}.traineddata.gz`;
    console.log(`  · descargando ${url}`);
    const response = await fetch(url);
    if (!response.ok || !response.body)
      throw new Error(`No fue posible descargar ${language}: HTTP ${response.status}`);

    await pipeline(Readable.fromWeb(response.body), createWriteStream(file));
    downloaded += 1;
  }
  return downloaded;
}

async function main() {
  await mkdir(target, { recursive: true });
  console.log("Preparando el motor de OCR en public/tesseract");

  const worker = await copyWorker();
  const core = await copyCore();
  const languages = await downloadLanguages();

  console.log(
    `Listo: ${worker} worker, ${core} archivos de motor, ${languages} modelo(s) nuevo(s).`,
  );
}

main().catch((error) => {
  // El OCR es una ayuda, no un requisito: sin estos archivos la aplicación
  // sigue funcionando con captura manual, así que no se rompe la instalación.
  console.warn("\n⚠ No se pudo preparar el OCR local:", error.message);
  console.warn(
    "  La captura de identificación seguirá funcionando en modo manual.",
  );
  console.warn("  Vuelve a intentarlo con: npm run setup:ocr\n");
  process.exit(0);
});
