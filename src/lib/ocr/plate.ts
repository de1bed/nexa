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

/** Un candidato a placa trae al menos una letra y un número de verdad. */
function looksLikePlate(token: string) {
  return /[A-Z]/.test(token) && /\d/.test(token);
}

/**
 * Candidatos exactos: cada palabra, y dos o tres palabras seguidas de la
 * misma línea («ABC 1234», «ABC 12 3A»). Antes se pegaba todo el texto y se
 * cortaba en ventanas, así que «frente 123ABC» salía como NTE-12-3A y
 * «credencial para votar» como RAV-07-AR.
 */
function candidates(raw: string) {
  const exact = new Set<string>();
  const loose = new Set<string>();
  for (const line of raw.toUpperCase().split(/\n+/)) {
    const words = line
      .split(/\s+/)
      .map((word) => word.replace(/[^A-Z0-9]/g, ""))
      .filter(Boolean);
    for (let index = 0; index < words.length; index += 1) {
      for (let span = 1; span <= 3 && index + span <= words.length; span += 1) {
        const token = words.slice(index, index + span).join("");
        if (token.length >= 5 && token.length <= 8 && looksLikePlate(token))
          exact.add(token);
      }
      // Una palabra larga suele ser ruido pegado: se revisa por dentro, con castigo.
      const word = words[index];
      if (word.length > 8)
        for (const size of [7, 6, 8])
          for (let at = 0; at + size <= word.length; at += 1) {
            const slice = word.slice(at, at + size);
            if (looksLikePlate(slice)) loose.add(slice);
          }
    }
  }
  return { exact, loose };
}

export function pickPlate(raw: string) {
  const { exact, loose } = candidates(raw);

  let best: { value: string; score: number } | null = null;
  const consider = (token: string, penalty: number) => {
    for (const pattern of MASKS) {
      const fitted = coerce(token, pattern.mask);
      if (!fitted) continue;
      const score = pattern.score - fitted.edits * 6 - penalty;
      if (!best || score > best.score) best = { value: fitted.value, score };
    }
  };
  for (const token of exact) consider(token, 0);
  for (const token of loose) consider(token, 12);

  const chosen = best as { value: string; score: number } | null;
  if (chosen && chosen.score >= 16) return formatPlate(chosen.value);

  for (const token of exact) {
    if (token.length < 6 || token.length > 8) continue;
    return formatPlate(token);
  }
  return null;
}
