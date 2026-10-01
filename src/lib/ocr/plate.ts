/**
 * Elige una placa mexicana dentro del texto del reconocedor.
 * En los lugares de letra convierte 8→B, 0→O y similares; en los de número,
 * al revés. El visitante confirma el resultado.
 */

const TO_LETTER: Record<string, string> = {
  "0": "O",
  "1": "I",
  "2": "Z",
  "5": "S",
  "6": "G",
  "8": "B",
};

const TO_DIGIT: Record<string, string> = {
  O: "0",
  Q: "0",
  D: "0",
  I: "1",
  L: "1",
  Z: "2",
  S: "5",
  G: "6",
  B: "8",
  T: "7",
};

/** L = letra, D = número, A = cualquiera de los dos. */
const MASKS = [
  { mask: "LLLDDDD", score: 40 },
  { mask: "LLLDDAA", score: 34 },
  { mask: "LLLDDD", score: 24 },
  { mask: "DDDLLL", score: 22 },
  { mask: "LLDDDD", score: 16 },
];

function formatPlate(value: string) {
  if (/^[A-Z]{3}\d{4}$/.test(value))
    return `${value.slice(0, 3)}-${value.slice(3)}`;
  if (/^[A-Z]{3}\d{2}[A-Z0-9]{2}$/.test(value))
    return `${value.slice(0, 3)}-${value.slice(3, 5)}-${value.slice(5)}`;
  if (/^[A-Z]{3}\d{3}$/.test(value))
    return `${value.slice(0, 3)}-${value.slice(3)}`;
  if (/^\d{3}[A-Z]{3}$/.test(value))
    return `${value.slice(0, 3)}-${value.slice(3)}`;
  if (/^[A-Z]{2}\d{4}$/.test(value))
    return `${value.slice(0, 2)}-${value.slice(2)}`;
  return value;
}

function coerce(token: string, mask: string) {
  if (token.length !== mask.length) return null;
  let value = "";
  let edits = 0;
  for (let index = 0; index < mask.length; index += 1) {
    const char = token[index] ?? "";
    const slot = mask[index];
    if (slot === "L") {
      if (/[A-Z]/.test(char)) value += char;
      else if (TO_LETTER[char]) {
        value += TO_LETTER[char];
        edits += 1;
      } else return null;
    } else if (slot === "D") {
      if (/[0-9]/.test(char)) value += char;
      else if (TO_DIGIT[char]) {
        value += TO_DIGIT[char];
        edits += 1;
      } else return null;
    } else if (/[A-Z0-9]/.test(char)) value += char;
    else return null;
  }
  return { value, edits };
}

function windows(token: string) {
  const sizes = [7, 6, 8];
  const found = new Set<string>();
  if (token.length >= 5 && token.length <= 8) found.add(token);
  for (const size of sizes) {
    for (let index = 0; index + size <= token.length; index += 1)
      found.add(token.slice(index, index + size));
  }
  return [...found];
}

export function pickPlate(raw: string) {
  const lines = raw
    .toUpperCase()
    .split(/\n+/)
    .map((line) => line.replace(/[^A-Z0-9]/g, ""))
    .filter((line) => line.length >= 5);

  const tokens = new Set<string>();
  for (const line of lines) {
    for (const token of windows(line)) tokens.add(token);
  }
  const glued = lines.join("");
  for (const token of windows(glued)) tokens.add(token);

  let best: { value: string; score: number } | null = null;
  for (const token of tokens) {
    for (const pattern of MASKS) {
      const fitted = coerce(token, pattern.mask);
      if (!fitted) continue;
      const score = pattern.score - fitted.edits * 6;
      if (!best || score > best.score) best = { value: fitted.value, score };
    }
  }

  if (best && best.score >= 16) return formatPlate(best.value);

  for (const token of tokens) {
    if (token.length < 6 || token.length > 8) continue;
    if (!/[A-Z]/.test(token) || !/\d/.test(token)) continue;
    return formatPlate(token);
  }
  return null;
}
