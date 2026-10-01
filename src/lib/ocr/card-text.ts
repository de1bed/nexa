/**
 * Saca el nombre y el folio del texto impreso en el frente de la INE.
 * La banda del reverso es un extra: si no se lee, el nombre de todas formas
 * puede salir de las líneas que están debajo de «NOMBRE».
 */

const STOP =
  /^(DOMICILIO|CURP|CLAVE|FECHA|SEXO|SECCION|SECCIÓN|ANO|AÑO|VIGENCIA|FOLIO|EDAD|ESTADO|MUNICIPIO|LOCALIDAD|EMISION|EMISIÓN|REGISTRO|COLONIA|CALLE|FIRMA|CP)\b/i;

const SKIP =
  /^(MEXICO|MÉXICO|INSTITUTO|NACIONAL|ELECTORAL|CREDENCIAL|PARA|VOTAR|IFE|INE|ESTADOS|UNIDOS|MEXICANOS)$/i;

const NOISE =
  /\b(INSTITUTO|NACIONAL|ELECTORAL|CREDENCIAL|VOTAR|MEXICO|MÉXICO|MEXICANOS|ESTADOS|UNIDOS|DOMICILIO|CLAVE|ELECTOR|CURP|FECHA|NACIMIENTO|VIGENCIA|SEXO|SECCION|SECCIÓN|FIRMA|LOCALIDAD|MUNICIPIO|COLONIA|EMISION|EMISIÓN|REGISTRO)\b/i;

const CLAVE = /[A-Z]{6}\d{8}[A-Z]\d{3}/;
const CURP = /[A-Z]{4}\d{6}[HM][A-Z]{5}[A-Z0-9]\d/;

function titleCase(value: string) {
  return value
    .toLowerCase()
    .replace(/(^|\s)\S/g, (chunk) => chunk.toUpperCase());
}

function cleanLetters(line: string) {
  return line
    .replace(/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isNameLine(line: string) {
  if (line.length < 2 || line.length > 40) return false;
  if (STOP.test(line) || SKIP.test(line) || NOISE.test(line)) return false;
  if (!/^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ ]+$/.test(line)) return false;
  if (!/[AEIOUÁÉÍÓÚÜaeiouáéíóúü]/i.test(line)) return false;
  return line.split(" ").length <= 4;
}

function isCapsLine(line: string) {
  const letters = line.replace(/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/g, "");
  if (letters.length < 3) return false;
  const upper = letters.replace(/[^A-ZÁÉÍÓÚÜÑ]/g, "").length;
  return upper / letters.length >= 0.7;
}

function arrange(parts: string[]) {
  if (parts.length >= 3) {
    const given = parts.slice(2).join(" ");
    const surnames = parts.slice(0, 2).join(" ");
    return titleCase(`${given} ${surnames}`);
  }
  if (parts.length === 2) return titleCase(`${parts[1]} ${parts[0]}`);
  return titleCase(parts[0] ?? "");
}

function nameFromLabel(rawLines: string[]) {
  const label = rawLines.findIndex((line) =>
    /^N[O0]MBRE\b/i.test(line.toUpperCase().replace(/0/g, "O")),
  );
  if (label < 0) return undefined;

  const parts: string[] = [];
  const sameLine = cleanLetters(
    rawLines[label].replace(/^N[O0]MBRE\b/i, ""),
  );
  if (isNameLine(sameLine)) parts.push(sameLine);

  for (const line of rawLines.slice(label + 1)) {
    const cleaned = cleanLetters(line);
    if (!cleaned) continue;
    if (STOP.test(cleaned)) break;
    if (SKIP.test(cleaned) || NOISE.test(cleaned)) continue;
    if (!isNameLine(cleaned)) break;
    parts.push(cleaned);
    if (parts.length >= 4) break;
  }

  if (parts.length >= 2) return arrange(parts);
  if (parts.length === 1 && parts[0].split(" ").length >= 2)
    return titleCase(parts[0]);
  return undefined;
}

/** Bloque en mayúsculas cuando el lector no alcanza a leer la palabra NOMBRE. */
function nameFromCaps(raw: string) {
  const runs: string[][] = [];
  let current: string[] = [];
  const flush = () => {
    if (current.length > 0) runs.push(current);
    current = [];
  };

  for (const line of raw.split(/\n+/)) {
    const trimmed = line.trim();
    if (!trimmed || !isCapsLine(trimmed)) {
      flush();
      continue;
    }
    const cleaned = cleanLetters(trimmed);
    if (!cleaned || !isNameLine(cleaned)) {
      flush();
      continue;
    }
    current.push(cleaned);
    if (current.length >= 4) flush();
  }
  flush();

  for (const parts of runs) {
    if (parts.length >= 2) return arrange(parts);
    const words = parts[0]?.split(" ") ?? [];
    if (words.length >= 3) return titleCase(parts[0]);
  }
  return undefined;
}

export function pickPrintedIdentity(raw: string) {
  const rawLines = raw
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

  const fullName = nameFromLabel(rawLines) || nameFromCaps(raw);
  const glued = raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const clave = glued.match(CLAVE)?.[0];
  const curp = glued.match(CURP)?.[0];

  return {
    fullName,
    documentNumber: clave ?? curp,
    curp,
  };
}
