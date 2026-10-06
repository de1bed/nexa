"use client";

import { useEffect, useState } from "react";
import { ClipboardList, ImageIcon } from "lucide-react";
import { Card, cn } from "./ui";
import { useI18n } from "./i18n-provider";
import type { VisitAttachment } from "@/lib/domain";

/**
 * Requisitos pedidos y anexos que entregó el visitante. Las fotos se abren con
 * el visor de documentos de la visita (URL firmada y auditada).
 */
export function VisitAttachments({
  visitId,
  live,
  onViewPhotos,
}: {
  visitId: string;
  live: boolean;
  onViewPhotos: () => void;
}) {
  const { t } = useI18n();
  const [items, setItems] = useState<VisitAttachment[]>([]);

  useEffect(() => {
    if (!live) return;
    let active = true;
    void (async () => {
      try {
        const response = await fetch(`/api/visits/${visitId}/attachments`, {
          cache: "no-store",
        });
        if (!response.ok) return;
        const payload = (await response.json()) as {
          attachments?: VisitAttachment[];
        };
        if (active) setItems(payload.attachments ?? []);
      } catch {
        // Sin anexos visibles: la tarjeta no se muestra.
      }
    })();
    return () => {
      active = false;
    };
  }, [live, visitId]);

  if (items.length === 0) return null;
  const hasPhotos = items.some((item) => item.photoCount > 0);
  // Los anexos libres sin título se numeran en el orden en que llegaron.
  const labels = items.map(
    (item, index) =>
      item.title ||
      t("visitor.attachmentN", {
        n: items
          .slice(0, index + 1)
          .filter((entry) => entry.source === "visitor").length,
      }),
  );

  return (
    <Card className="p-5 sm:p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 font-semibold">
          <ClipboardList size={18} />
          {t("visits.attachments")}
        </h2>
        {hasPhotos && (
          <button
            type="button"
            onClick={onViewPhotos}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold"
          >
            <ImageIcon size={14} />
            {t("visits.viewAttachments")}
          </button>
        )}
      </div>
      <ul className="space-y-3">
        {items.map((item, index) => {
          const done = Boolean(item.completedAt);
          return (
            <li key={item.id} className="rounded-2xl bg-slate-50 p-4">
              <div className="flex items-start justify-between gap-3">
                <p className="font-semibold leading-snug">{labels[index]}</p>
                <span
                  className={cn(
                    "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold",
                    item.source === "visitor"
                      ? "bg-slate-200 text-slate-600"
                      : done
                        ? "bg-emerald-100 text-emerald-700"
                        : item.required
                          ? "bg-amber-100 text-amber-700"
                          : "bg-slate-200 text-slate-600",
                  )}
                >
                  {item.source === "visitor"
                    ? t("visits.attachmentByVisitor")
                    : done
                      ? t("visits.attachmentDone")
                      : t("visits.attachmentPending")}
                </span>
              </div>
              {item.source === "requested" && item.description && (
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  {item.description}
                </p>
              )}
              {item.responseText && (
                <p className="mt-2 whitespace-pre-line text-sm leading-6 text-[#071426]">
                  {item.responseText}
                </p>
              )}
              {item.photoCount > 0 && (
                <p className="mt-2 text-xs font-medium text-slate-500">
                  {t("visits.attachmentPhotos", { n: item.photoCount })}
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
