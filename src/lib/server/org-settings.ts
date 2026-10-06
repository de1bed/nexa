import "server-only";
import type { OrganizationSettings } from "@/lib/domain";
import { DEFAULT_RETENTION_DAYS } from "@/lib/retention";
import {
  parseVisitorFlow,
  requireIdentificationFromFlow,
} from "@/lib/visitor-flow";

/** Columnas de `organization_settings` que viajan al cliente. */
export const settingsColumns =
  "document_retention_days,document_retention_unlimited,allow_document_preview_for_guards,require_identification,visitor_flow,early_entry_minutes,late_entry_minutes,privacy_notice,privacy_notice_version";

export type SettingsRow = {
  document_retention_days?: number | null;
  document_retention_unlimited?: boolean | null;
  allow_document_preview_for_guards?: boolean | null;
  require_identification?: boolean | null;
  visitor_flow?: unknown;
  early_entry_minutes?: number | null;
  late_entry_minutes?: number | null;
  privacy_notice?: string | null;
  privacy_notice_version?: string | null;
};

/** Una sola proyección de la configuración para todas las rutas. */
export function serializeSettings(
  data: SettingsRow | null | undefined,
): OrganizationSettings {
  const visitorFlow = parseVisitorFlow(
    data?.visitor_flow,
    data?.require_identification !== false,
  );
  return {
    documentRetentionDays:
      data?.document_retention_days ?? DEFAULT_RETENTION_DAYS,
    documentRetentionUnlimited: data?.document_retention_unlimited !== false,
    allowDocumentPreviewForGuards:
      data?.allow_document_preview_for_guards ?? false,
    requireIdentification: requireIdentificationFromFlow(visitorFlow),
    visitorFlow,
    earlyEntryMinutes: data?.early_entry_minutes ?? 15,
    lateEntryMinutes: data?.late_entry_minutes ?? 30,
    privacyNotice: data?.privacy_notice ?? "",
    privacyNoticeVersion: data?.privacy_notice_version ?? "mvp-1",
  };
}
