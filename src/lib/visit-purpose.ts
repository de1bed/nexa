/** Valor del select cuando el motivo no está en la lista. */
export const OTHER_PURPOSE = "Otro";

/** El motivo guardado es el texto libre cuando eligen Otro. */
export function resolvedPurpose(selected: string, other: string) {
  const choice = selected.trim();
  if (choice === OTHER_PURPOSE) return other.trim();
  return choice;
}
