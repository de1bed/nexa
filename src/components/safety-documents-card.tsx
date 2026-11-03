"use client";

import { useEffect, useState } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button, fieldClass } from "./ui";
import { useI18n } from "./i18n-provider";
import type { SafetyDocument } from "@/lib/safety-documents";

function blankDocument(): SafetyDocument {
  return { id: crypto.randomUUID(), title: "", body: "", url: "" };
}

export function SafetyDocumentsCard({ live }: { live: boolean }) {
  const { t } = useI18n();
  const [documents, setDocuments] = useState<SafetyDocument[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!live) return;
    let active = true;
    void fetch("/api/safety-documents", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok || !active) return;
        const payload = (await response.json()) as { documents?: SafetyDocument[] };
        if (active) setDocuments(payload.documents ?? []);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [live]);

  function update(id: string, patch: Partial<SafetyDocument>) {
    setDocuments((current) =>
      current.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    );
  }

  async function save() {
    const ready = documents
      .map((item) => ({
        ...item,
        title: item.title.trim(),
        body: item.body.trim(),
        url: item.url.trim(),
      }))
      .filter((item) => item.title.length >= 2);
    setBusy(true);
    try {
      if (!live) {
        setDocuments(ready);
        toast.success(t("settings.safetySaved"));
        return;
      }
      const response = await fetch("/api/safety-documents", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documents: ready }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        documents?: SafetyDocument[];
      };
      if (!response.ok) throw new Error(payload.error ?? t("settings.safetyFail"));
      setDocuments(payload.documents ?? ready);
      toast.success(t("settings.safetySaved"));
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : t("settings.safetyFail"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-6 border-t border-slate-100 pt-5">
      <h3 className="text-sm font-semibold">{t("settings.safetyTitle")}</h3>
      <p className="mt-1.5 text-sm leading-6 text-slate-500">{t("settings.safetyHint")}</p>
      {documents.length === 0 && (
        <p className="mt-3 text-sm text-slate-400">{t("settings.safetyEmpty")}</p>
      )}
      <div className="mt-3 space-y-3">
        {documents.map((document) => (
          <div key={document.id} className="rounded-2xl border border-slate-200 p-3">
            <div className="flex gap-2">
              <input
                className={fieldClass}
                placeholder={t("settings.safetyDocTitle")}
                value={document.title}
                maxLength={120}
                onChange={(event) => update(document.id, { title: event.target.value })}
              />
              <button
                type="button"
                aria-label={t("team.departmentRemove")}
                onClick={() =>
                  setDocuments((current) => current.filter((item) => item.id !== document.id))
                }
                className="grid size-11 shrink-0 place-items-center rounded-2xl text-red-600"
              >
                <Trash2 size={16} />
              </button>
            </div>
            <textarea
              rows={3}
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-white p-3 text-[15px] leading-6 outline-none focus:border-[#10aaa5]"
              placeholder={t("settings.safetyDocBody")}
              value={document.body}
              maxLength={2000}
              onChange={(event) => update(document.id, { body: event.target.value })}
            />
            <input
              className={`${fieldClass} mt-2`}
              placeholder={t("settings.safetyDocUrl")}
              value={document.url}
              maxLength={500}
              onChange={(event) => update(document.id, { url: event.target.value })}
            />
          </div>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => setDocuments((current) => [...current, blankDocument()])}
        >
          <Plus size={16} />
          {t("settings.safetyAdd")}
        </Button>
        <Button type="button" variant="accent" disabled={busy} onClick={() => void save()}>
          {busy ? <Loader2 size={16} className="animate-spin" /> : null}
          {t("settings.safetySave")}
        </Button>
      </div>
    </div>
  );
}
