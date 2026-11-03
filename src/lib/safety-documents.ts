export type SafetyDocument = {
  id: string;
  title: string;
  body: string;
  url: string;
};

function asText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

/** Ignora filas incompletas. El enlace, si viene, tiene que ser https. */
export function parseSafetyDocuments(value: unknown): SafetyDocument[] {
  if (!Array.isArray(value)) return [];
  const documents: SafetyDocument[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const title = asText(row.title);
    const url = asText(row.url);
    if (title.length < 2) continue;
    if (url && !/^https:\/\//i.test(url)) continue;
    const id = asText(row.id);
    if (!id) continue;
    documents.push({
      id,
      title: title.slice(0, 120),
      body: asText(row.body).slice(0, 2000),
      url: url.slice(0, 500),
    });
    if (documents.length >= 20) break;
  }
  return documents;
}
