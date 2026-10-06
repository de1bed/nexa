import "server-only";
import type { Requirement, VisitAttachment } from "@/lib/domain";

/** Proyección de `organization_requirements` y `visit_attachments` al dominio. */

export const requirementColumns =
  "id,title,description,ask_photo,ask_text,required,apply_by_default,active,sort_order";

export const attachmentColumns =
  "id,source,requirement_id,title,description,ask_photo,ask_text,required,response_text,completed_at,sort_order," +
  "documents:visitor_documents(id,deleted_at)";

type Row = Record<string, unknown>;

export function mapRequirement(row: Row): Requirement {
  return {
    id: String(row.id),
    title: String(row.title ?? ""),
    description: String(row.description ?? ""),
    askPhoto: row.ask_photo !== false,
    askText: row.ask_text === true,
    required: row.required === true,
    applyByDefault: row.apply_by_default !== false,
    active: row.active !== false,
  };
}

export function mapAttachment(row: Row): VisitAttachment {
  const documents = Array.isArray(row.documents)
    ? (row.documents as Array<{ deleted_at?: string | null }>)
    : [];
  return {
    id: String(row.id),
    source: row.source === "visitor" ? "visitor" : "requested",
    requirementId: (row.requirement_id as string | null) ?? undefined,
    title: String(row.title ?? ""),
    description: String(row.description ?? ""),
    askPhoto: row.ask_photo !== false,
    askText: row.ask_text !== false,
    required: row.required === true,
    responseText: (row.response_text as string | null) ?? undefined,
    photoCount: documents.filter((document) => !document.deleted_at).length,
    completedAt: (row.completed_at as string | null) ?? undefined,
  };
}
