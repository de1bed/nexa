import { catalogs } from "./messages";
import { interpolate, type Locale } from "./types";

type Vars = Record<string, string | number>;

function lookup(locale: Locale, path: string): string | undefined {
  const parts = path.split(".");
  let current: unknown = catalogs[locale];
  for (const part of parts) {
    if (!current || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return typeof current === "string" ? current : undefined;
}

export function translate(path: string, vars?: Vars, locale: Locale = "es") {
  const text = lookup(locale, path) ?? lookup("es", path) ?? path;
  return interpolate(text, vars);
}
