import { formatGuardCode, normalizeGuardCode } from "./guard-code";

/** Códigos de la empresa de ejemplo. Sirven en la tableta de la demostración. */
export const DEMO_GUARD_CODES = [
  { id: "demo-guard", name: "Carlos Mendoza", code: "4821-9036" },
  { id: "guard-lucia", name: "Lucía Herrera", code: "7352-6410" },
] as const;

const STORAGE_KEY = "nexa-guard-codes";

export type DemoGuardCode = { id: string; name: string; code: string };

export function readExtraGuardCodes(): DemoGuardCode[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as DemoGuardCode[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveExtraGuardCode(entry: DemoGuardCode) {
  const next = [
    entry,
    ...readExtraGuardCodes().filter((item) => item.id !== entry.id),
  ];
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

export function findDemoGuardByCode(raw: string): DemoGuardCode | null {
  const code = normalizeGuardCode(raw);
  if (code.length < 8) return null;
  const seeded = DEMO_GUARD_CODES.find(
    (guard) => normalizeGuardCode(guard.code) === code,
  );
  if (seeded) return { ...seeded };
  return (
    readExtraGuardCodes().find(
      (guard) => normalizeGuardCode(guard.code) === code,
    ) ?? null
  );
}

export function displayGuardCode(raw: string) {
  return formatGuardCode(raw);
}
