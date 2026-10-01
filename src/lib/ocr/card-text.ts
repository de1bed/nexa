/**
 * Saca el nombre y el folio del texto impreso en el frente de la INE.
 * La banda del reverso es un extra: si no se lee, el nombre de todas formas
 * puede salir de las líneas que están debajo de «NOMBRE».
 */

const STOP =
  /^(DOMICILIO|CURP|CLAVE|FECHA|SEXO|SECCION|SECCIÓN|ANO|AÑO|VIGENCIA|FOLIO|EDAD|ESTADO|MUNICIPIO|LOCALIDAD|EMISION|EMISIÓN|REGISTRO|COLONIA|CALLE|FIRMA|CP)\b/i;

const SKIP =
  /^(MEXICO|MÉXICO|INSTITUTO|NACIONAL|ELECTORAL|CREDENCIAL|PARA|VOTAR|IFE|INE|ESTADOS|UNIDOS|MEXICANOS)$/i;

const CLAVE = /[A-Z]{6}\d{8}[A-Z]\d{3}/;
const CURP = /[A-Z]{4}\d{6}[HM][A-Z]{5}[A-Z0-9]\d/;

function titleCase(value: string) {
  return value
    .toLowerCase()
    .replace(/(^|\s)\S/g, (chunk) => chunk.toUpperCase());
}

function linesOf(raw: string) {
  return raw
    .split(/\n+/)
    .map((line) =>
      line
        .replace(/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ\s]/g, " ")
        .replace(/\s+/g, " ")
        .trim(),
    )
    .filter(Boolean);
}

function isNameLine(line: string) {
  if (line.length < 2 || line.length > 40) return false;
  if (STOP.test(line) || SKIP.test(line)) return false;
  if (!/^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ ]+$/.test(line)) return false;
  return line.split(" ").length <= 4;
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

export function pickPrintedIdentity(raw: string) {
  const lines = linesOf(raw);
  const label = lines.findIndex((line) => /^NOMBRE\b/i.test(line));
  const parts: string[] = [];

  if (label >= 0) {
    const sameLine = lines[label].replace(/^NOMBRE\b/i, "").trim();
    if (isNameLine(sameLine)) parts.push(sameLine);
    for (const line of lines.slice(label + 1)) {
      if (STOP.test(line)) break;
      if (SKIP.test(line)) continue;
      if (!isNameLine(line)) break;
      parts.push(line);
      if (parts.length >= 4) break;
    }
  }

  const fullName = parts.length >= 2 ? arrange(parts) : undefined;
  const glued = raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const clave = glued.match(CLAVE)?.[0];
  const curp = glued.match(CURP)?.[0];

  return {
    fullName,
    documentNumber: clave ?? curp,
    curp,
  };
}
