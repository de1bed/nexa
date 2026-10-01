/**
 * Elige una placa mexicana dentro del texto que devolvió el reconocedor.
 * No corrige letras por números: el visitante confirma el resultado.
 */

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

export function pickPlate(raw: string) {
  const glued = raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (glued.length < 5) return null;

  const found: Array<{ value: string; score: number }> = [];
  const consider = (value: string, score: number) => {
    if (found.some((item) => item.value === value)) return;
    found.push({ value, score });
  };

  for (const match of glued.matchAll(/[A-Z]{3}\d{2}[A-Z0-9]{2}/g))
    consider(match[0], 30);
  for (const match of glued.matchAll(/[A-Z]{3}\d{3}(?!\d)/g))
    consider(match[0], 20);
  for (const match of glued.matchAll(/\d{3}[A-Z]{3}/g)) consider(match[0], 20);
  for (const match of glued.matchAll(/[A-Z]{2}\d{4}(?!\d)/g))
    consider(match[0], 10);

  found.sort(
    (a, b) => b.score - a.score || b.value.length - a.value.length,
  );
  const best = found[0];
  return best ? formatPlate(best.value) : null;
}
