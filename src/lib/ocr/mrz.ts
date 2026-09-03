/**
 * Lectura de la zona legible por máquina (MRZ) del reverso de la credencial.
 *
 * La INE reciente usa el formato TD1 de la norma ICAO 9303: tres renglones de
 * treinta caracteres en tipografía monoespaciada, pensados para máquinas. A
 * diferencia del anverso —texto en varias tipografías, tamaños y posiciones—
 * el MRZ trae **dígitos de control**, así que se puede verificar si la lectura
 * fue correcta en vez de confiar a ciegas en el OCR.
 *
 * Estructura TD1 (posiciones 0-indexadas):
 *
 *   Renglón 1  [0:2]  tipo de documento        [2:5]   estado emisor
 *              [5:14] número de documento      [14]    control
 *              [15:30] datos opcionales (en la INE, la CURP)
 *
 *   Renglón 2  [0:6]  nacimiento AAMMDD        [6]     control
 *              [7]    sexo                     [8:14]  vigencia AAMMDD
 *              [14]   control                  [15:18] nacionalidad
 *              [18:29] datos opcionales        [29]    control compuesto
 *
 *   Renglón 3  [0:30] APELLIDOS<<NOMBRES
 */

export const MRZ_LINE_LENGTH = 30;
export const MRZ_LINE_COUNT = 3;

export type MrzCheck = "valid" | "invalid" | "missing";

export type MrzResult = {
  documentCode: string;
  issuingState: string;
  documentNumber: string;
  nationality: string;
  sex: "M" | "F" | "X";
  birthDate?: string;
  expiryDate?: string;
  surnames: string;
  givenNames: string;
  fullName: string;
  curp?: string;
  optionalData: string;
  /** Resultado de cada dígito de control de la norma. */
  checks: {
    documentNumber: MrzCheck;
    birthDate: MrzCheck;
    expiryDate: MrzCheck;
    composite: MrzCheck;
  };
  /** 0–100. Proporción de dígitos de control que cuadraron. */
  confidence: number;
  /** `true` solo si todos los dígitos de control son correctos. */
  verified: boolean;
  lines: [string, string, string];
};

/* -------------------------------------------------------------------------- */
/* Normalización                                                              */
/* -------------------------------------------------------------------------- */

/** Confusiones habituales del OCR cuando la posición debe ser un dígito. */
const toDigit: Record<string, string> = {
  O: "0",
  Q: "0",
  D: "0",
  I: "1",
  L: "1",
  Z: "2",
  S: "5",
  B: "8",
  G: "6",
  T: "7",
  A: "4",
};

/** Confusiones habituales cuando la posición debe ser una letra. */
const toLetter: Record<string, string> = {
  "0": "O",
  "1": "I",
  "2": "Z",
  "5": "S",
  "8": "B",
  "6": "G",
};

function digitsOnly(value: string) {
  return [...value].map((char) => toDigit[char] ?? char).join("");
}

function lettersOnly(value: string) {
  return [...value].map((char) => toLetter[char] ?? char).join("");
}

/**
 * Deja solo el alfabeto del MRZ y normaliza el relleno. El OCR suele devolver
 * guiones, espacios o «K» donde la norma usa «<».
 */
export function normalizeMrzLine(raw: string) {
  return raw
    .toUpperCase()
    .replace(/[«»＜]/g, "<")
    .replace(/[\s\-_—–]/g, "<")
    .replace(/[^A-Z0-9<]/g, "")
    .slice(0, MRZ_LINE_LENGTH)
    .padEnd(MRZ_LINE_LENGTH, "<");
}

/**
 * Localiza los tres renglones del MRZ dentro del texto crudo del OCR.
 * Se queda con las últimas líneas largas compuestas por el alfabeto del MRZ,
 * que es donde vive la banda en el reverso.
 */
export function findMrzLines(rawText: string): [string, string, string] | null {
  const candidates = rawText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map(normalizeMrzLine)
    // Una línea del MRZ es casi toda mayúsculas, dígitos y rellenos.
    .filter((line) => {
      const filler = (line.match(/</g) ?? []).length;
      const content = MRZ_LINE_LENGTH - filler;
      return content >= 5 && /[A-Z0-9]/.test(line);
    });

  if (candidates.length < MRZ_LINE_COUNT) return null;

  // El renglón de nombres no contiene dígitos y suele traer «<<».
  const nameIndex = candidates.findIndex(
    (line, index) =>
      index >= 2 && !/\d/.test(line.replace(/</g, "")) && line.includes("<<"),
  );

  const end = nameIndex >= 0 ? nameIndex + 1 : candidates.length;
  const window = candidates.slice(Math.max(0, end - MRZ_LINE_COUNT), end);
  if (window.length < MRZ_LINE_COUNT) return null;

  return [window[0], window[1], window[2]];
}

/* -------------------------------------------------------------------------- */
/* Dígitos de control                                                          */
/* -------------------------------------------------------------------------- */

const WEIGHTS = [7, 3, 1];

function charValue(char: string) {
  if (char >= "0" && char <= "9") return char.charCodeAt(0) - 48;
  if (char >= "A" && char <= "Z") return char.charCodeAt(0) - 55;
  return 0; // '<' y cualquier residuo
}

/** Suma ponderada 7-3-1 módulo 10, como define ICAO 9303. */
export function checkDigit(value: string) {
  return (
    [...value].reduce(
      (total, char, index) => total + charValue(char) * WEIGHTS[index % 3],
      0,
    ) % 10
  );
}

function verify(value: string, expected: string): MrzCheck {
  if (!/^\d$/.test(expected)) return "missing";
  return checkDigit(value) === Number(expected) ? "valid" : "invalid";
}

/* -------------------------------------------------------------------------- */
/* Campos                                                                      */
/* -------------------------------------------------------------------------- */

const CURP_PATTERN = /[A-Z]{4}\d{6}[HM][A-Z]{5}[0-9A-Z]\d/;

/**
 * `AAMMDD` a `AAAA-MM-DD`.
 * Una fecha de nacimiento nunca es futura; una vigencia nunca es del siglo XX.
 */
export function parseMrzDate(
  value: string,
  kind: "birth" | "expiry",
  now = new Date(),
) {
  const digits = digitsOnly(value);
  if (!/^\d{6}$/.test(digits)) return undefined;

  const year = Number(digits.slice(0, 2));
  const month = Number(digits.slice(2, 4));
  const day = Number(digits.slice(4, 6));
  if (month < 1 || month > 12 || day < 1 || day > 31) return undefined;

  const currentShort = now.getFullYear() % 100;
  const century =
    kind === "expiry" ? 2000 : year > currentShort ? 1900 : 2000;

  const iso = `${century + year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  return Number.isNaN(new Date(iso).getTime()) ? undefined : iso;
}

/** `PEREZ<GOMEZ<<JUAN<CARLOS` → apellidos y nombres por separado. */
export function parseMrzName(line: string) {
  const [primary = "", secondary = ""] = line.split("<<");
  const clean = (value: string) =>
    lettersOnly(value)
      .split("<")
      .filter(Boolean)
      .join(" ")
      .trim();

  const surnames = clean(primary);
  const givenNames = clean(secondary);
  return {
    surnames,
    givenNames,
    // En español el nombre de pila va primero, los apellidos después.
    fullName: [givenNames, surnames].filter(Boolean).join(" "),
  };
}

/* -------------------------------------------------------------------------- */
/* Lectura completa                                                            */
/* -------------------------------------------------------------------------- */

/**
 * Interpreta tres renglones TD1 ya normalizados.
 * Devuelve `null` solo si la forma es irrecuperable; si algún dígito de control
 * falla, devuelve el resultado marcado como no verificado para que la interfaz
 * pida revisión en vez de descartar la lectura.
 */
export function parseTd1(
  rawLines: string[],
  now = new Date(),
): MrzResult | null {
  if (rawLines.length < MRZ_LINE_COUNT) return null;
  const [line1, line2, line3] = rawLines
    .slice(0, MRZ_LINE_COUNT)
    .map(normalizeMrzLine) as [string, string, string];

  const documentNumberRaw = line1.slice(5, 14);
  const documentCheck = digitsOnly(line1.slice(14, 15));
  const optionalData1 = line1.slice(15, 30);

  const birthRaw = line2.slice(0, 6);
  const birthCheck = digitsOnly(line2.slice(6, 7));
  const sexRaw = line2.slice(7, 8);
  const expiryRaw = line2.slice(8, 14);
  const expiryCheck = digitsOnly(line2.slice(14, 15));
  const nationality = lettersOnly(line2.slice(15, 18)).replace(/</g, "");
  const optionalData2 = line2.slice(18, 29);
  const compositeCheck = digitsOnly(line2.slice(29, 30));

  const composite =
    line1.slice(5, 30) +
    line2.slice(0, 7) +
    line2.slice(8, 15) +
    line2.slice(18, 29);

  const checks = {
    documentNumber: verify(documentNumberRaw, documentCheck),
    birthDate: verify(digitsOnly(birthRaw), birthCheck),
    expiryDate: verify(digitsOnly(expiryRaw), expiryCheck),
    composite: verify(composite, compositeCheck),
  };

  const evaluated = Object.values(checks).filter(
    (value) => value !== "missing",
  );
  const passed = evaluated.filter((value) => value === "valid").length;
  const confidence = evaluated.length
    ? Math.round((passed / evaluated.length) * 100)
    : 0;

  const optional = `${optionalData1}${optionalData2}`.replace(/</g, "");
  const name = parseMrzName(line3);

  return {
    documentCode: lettersOnly(line1.slice(0, 2)).replace(/</g, ""),
    issuingState: lettersOnly(line1.slice(2, 5)).replace(/</g, ""),
    documentNumber: documentNumberRaw.replace(/</g, ""),
    nationality,
    sex: sexRaw === "M" ? "M" : sexRaw === "F" ? "F" : "X",
    birthDate: parseMrzDate(birthRaw, "birth", now),
    expiryDate: parseMrzDate(expiryRaw, "expiry", now),
    ...name,
    curp: optional.match(CURP_PATTERN)?.[0],
    optionalData: optional,
    checks,
    confidence,
    verified: evaluated.length > 0 && passed === evaluated.length,
    lines: [line1, line2, line3],
  };
}

/** Atajo: del texto crudo del OCR al resultado interpretado. */
export function readMrz(rawText: string, now = new Date()) {
  const lines = findMrzLines(rawText);
  return lines ? parseTd1(lines, now) : null;
}

/** `true` si la credencial ya venció según su MRZ. */
export function isExpired(result: MrzResult, now = new Date()) {
  if (!result.expiryDate) return false;
  return new Date(result.expiryDate).getTime() < now.getTime();
}
