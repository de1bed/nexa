"use client";

import { useEffect, useRef, useState } from "react";
import { FileText, Loader2, ShieldCheck, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button, Callout, Card, Field, fieldClass } from "./ui";
import { useI18n } from "./i18n-provider";

type SecurityDocument = {
  id: string;
  title: string;
  mimeType: string;
  sizeBytes: number;
};

async function readError(response: Response, fallback: string) {
  const payload = (await response.json().catch(() => ({}))) as { error?: string };
  return payload.error ?? fallback;
}

/**
 * Documentos de seguridad (reglamento, EPP, rutas de evacuación) que el
 * visitante abre desde su invitación y acepta antes de recibir el pase.
 */
export function SecurityDocumentsCard({ live }: { live: boolean }) {
  const { t } = useI18n();
  const [documents, setDocuments] = useState<SecurityDocument[]>([]);
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!live) return;
    let active = true;
    void fetch("/api/security-documents", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok || !active) return;
        const payload = (await response.json()) as { documents?: SecurityDocument[] };
        if (active) setDocuments(payload.documents ?? []);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [live]);

  async function upload(event: React.FormEvent) {
    event.preventDefault();
    if (!live) {
      toast.info(t("settings.securityDemo"));
      return;
    }
    if (title.trim().length < 2 || !file) return;
    setBusy(true);
    try {
      const form = new FormData();
      form.set("title", title.trim());
      form.set("file", file);
      const response = await fetch("/api/security-documents", { method: "POST", body: form });
      if (!response.ok) throw new Error(await readError(response, t("common.error")));
      const payload = (await response.json()) as { document: SecurityDocument };
      setDocuments((current) => [...current, payload.document]);
      setTitle("");
      setFile(null);
      if (inputRef.current) inputRef.current.value = "";
      toast.success(t("settings.securityUploaded"));
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : t("common.error"));
    } finally {
      setBusy(false);
    }
  }

  async function remove(item: SecurityDocument) {
    if (!window.confirm(t("settings.securityRemoveConfirm", { title: item.title }))) return;
    const response = await fetch(`/api/security-documents/${item.id}`, { method: "DELETE" });
    if (!response.ok) {
      toast.error(await readError(response, t("common.error")));
      return;
    }
    setDocuments((current) => current.filter((entry) => entry.id !== item.id));
    toast.success(t("settings.securityRemoved"));
  }

  return (
    <Card className="p-5 sm:p-6">
      <h2 className="flex items-center gap-2 font-semibold">
        <ShieldCheck size={18} />
        {t("settings.securityTitle")}
      </h2>
      <p className="mt-1.5 text-sm text-slate-500">{t("settings.securityHint")}</p>

      {!live && (
        <Callout tone="info" className="mt-4">
          {t("settings.securityDemo")}
        </Callout>
      )}

      {documents.length === 0 ? (
        <p className="mt-4 text-sm text-slate-400">{t("settings.securityEmpty")}</p>
      ) : (
        <ul className="mt-4 space-y-2">
          {documents.map((item) => (
            <li
              key={item.id}
              className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 px-3 py-2.5 text-sm"
            >
              <span className="flex min-w-0 items-center gap-2">
                <FileText size={16} className="shrink-0 text-[#0d9d99]" />
                <span className="truncate font-medium">{item.title}</span>
              </span>
              <span className="flex shrink-0 gap-1">
                <a
                  href={`/api/security-documents/${item.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-8 items-center rounded-xl px-2.5 text-xs font-semibold text-slate-600 hover:bg-white"
                >
                  {t("settings.securityView")}
                </a>
                <button
                  type="button"
                  onClick={() => void remove(item)}
                  className="inline-flex h-8 items-center gap-1 rounded-xl px-2.5 text-xs font-semibold text-red-600 hover:bg-white"
                >
                  <Trash2 size={14} />
                  {t("settings.securityRemove")}
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={upload} className="mt-4 space-y-3">
        <Field label={t("settings.securityDocTitle")}>
          <input
            className={fieldClass}
            maxLength={120}
            placeholder={t("settings.securityDocTitlePlaceholder")}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
        </Field>
        <Field label={t("settings.securityFile")}>
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf,image/png,image/jpeg,image/webp"
            className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-xl file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-semibold"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          />
        </Field>
        <Button
          type="submit"
          variant="outline"
          disabled={busy || (live && (title.trim().length < 2 || !file))}
        >
          {busy ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
          {t("settings.securityUpload")}
        </Button>
      </form>
    </Card>
  );
}
