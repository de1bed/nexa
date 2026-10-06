"use client";

import { useState } from "react";
import { ClipboardList, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useWorkspace } from "./workspace-provider";
import { Button, Card, Field, cn, fieldClass } from "./ui";
import { Sheet, Toggle } from "./ui-client";
import { useI18n } from "./i18n-provider";
import { requirementSchema, type RequirementInput } from "@/lib/schemas";
import type { Requirement } from "@/lib/domain";

const blank: RequirementInput = {
  title: "",
  description: "",
  askPhoto: true,
  askText: false,
  required: false,
  applyByDefault: true,
};

async function readError(response: Response, fallback: string) {
  try {
    const body = (await response.json()) as { error?: string };
    return body.error ?? fallback;
  } catch {
    return fallback;
  }
}

/**
 * Catálogo de requisitos de la empresa. Cada uno trae título y descripción ya
 * escritos; al crear una invitación se eligen cuáles se le piden al visitante.
 */
export function RequirementsCard() {
  const { live, requirements, reload } = useWorkspace();
  const { t } = useI18n();
  // En vitrina los cambios viven solo en esta pantalla.
  const [local, setLocal] = useState<Requirement[]>(requirements);
  const items = live ? requirements : local;

  const [editing, setEditing] = useState<Requirement | "new" | null>(null);
  const [form, setForm] = useState<RequirementInput>(blank);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  function open(target: Requirement | "new") {
    setEditing(target);
    setError("");
    setForm(
      target === "new"
        ? blank
        : {
            title: target.title,
            description: target.description,
            askPhoto: target.askPhoto,
            askText: target.askText,
            required: target.required,
            applyByDefault: target.applyByDefault,
          },
    );
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    const parsed = requirementSchema.safeParse(form);
    if (!parsed.success) {
      setError(
        parsed.error.issues[0]?.path[0] === "askPhoto"
          ? t("requirements.askSomething")
          : (parsed.error.issues[0]?.message ?? t("requirements.saveFail")),
      );
      return;
    }

    setBusy(true);
    try {
      if (live) {
        const response = await fetch(
          editing === "new" || !editing
            ? "/api/requirements"
            : `/api/requirements/${editing.id}`,
          {
            method: editing === "new" ? "POST" : "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(parsed.data),
          },
        );
        if (!response.ok)
          throw new Error(await readError(response, t("requirements.saveFail")));
        await reload(true);
      } else {
        setLocal((current) =>
          editing === "new"
            ? [...current, { id: crypto.randomUUID(), active: true, ...parsed.data }]
            : current.map((item) =>
                editing && item.id === editing.id
                  ? { ...item, ...parsed.data }
                  : item,
              ),
        );
      }
      toast.success(t("requirements.saved"));
      setEditing(null);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : t("requirements.saveFail"),
      );
    } finally {
      setBusy(false);
    }
  }

  async function remove(item: Requirement) {
    setBusy(true);
    try {
      if (live) {
        const response = await fetch(`/api/requirements/${item.id}`, {
          method: "DELETE",
        });
        if (!response.ok)
          throw new Error(await readError(response, t("requirements.saveFail")));
        await reload(true);
      } else {
        setLocal((current) => current.filter((entry) => entry.id !== item.id));
      }
      toast.success(t("requirements.removed"));
      setEditing(null);
    } catch (reason) {
      toast.error(
        reason instanceof Error ? reason.message : t("requirements.saveFail"),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="p-5 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 font-semibold">
            <ClipboardList size={18} />
            {t("requirements.title")}
          </h2>
          <p className="mt-1.5 text-sm text-slate-500">{t("requirements.hint")}</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="shrink-0"
          onClick={() => open("new")}
        >
          <Plus size={16} />
          <span className="hidden sm:inline">{t("requirements.add")}</span>
        </Button>
      </div>

      <div className="mt-5 space-y-2">
        {items.length === 0 ? (
          <button
            type="button"
            onClick={() => open("new")}
            className="w-full rounded-2xl border-2 border-dashed border-slate-200 p-5 text-center text-sm text-slate-500 transition active:bg-slate-50"
          >
            {t("requirements.empty")}
          </button>
        ) : (
          items.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => open(item)}
              className="flex w-full items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-left transition active:bg-slate-50"
            >
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-[#071426]">
                  {item.title}
                </span>
                {item.description && (
                  <span className="mt-0.5 line-clamp-2 block text-xs leading-5 text-slate-500">
                    {item.description}
                  </span>
                )}
                <span className="mt-1.5 flex flex-wrap gap-1.5">
                  {item.askPhoto && <Tag>{t("requirements.photo")}</Tag>}
                  {item.askText && <Tag>{t("requirements.text")}</Tag>}
                  <Tag strong={item.required}>
                    {item.required
                      ? t("requirements.required")
                      : t("requirements.optional")}
                  </Tag>
                  {item.applyByDefault && <Tag>{t("requirements.byDefault")}</Tag>}
                </span>
              </span>
              <Pencil size={16} className="mt-0.5 shrink-0 text-slate-400" />
            </button>
          ))
        )}
      </div>

      <Sheet
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing === "new" ? t("requirements.add") : t("requirements.edit")}
      >
        <form onSubmit={save} className="space-y-4">
          <Field label={t("requirements.fieldTitle")}>
            <input
              autoFocus
              maxLength={120}
              className={fieldClass}
              placeholder={t("requirements.fieldTitlePlaceholder")}
              value={form.title}
              onChange={(event) => setForm({ ...form, title: event.target.value })}
            />
          </Field>
          <Field label={t("requirements.fieldDescription")} optional>
            <textarea
              rows={3}
              maxLength={1000}
              className="w-full rounded-2xl border border-slate-200 bg-white p-4 text-[16px] outline-none focus:border-[#10aaa5] focus:ring-4 focus:ring-[#10cfc9]/15"
              placeholder={t("requirements.fieldDescriptionPlaceholder")}
              value={form.description}
              onChange={(event) =>
                setForm({ ...form, description: event.target.value })
              }
            />
          </Field>
          <Toggle
            checked={form.askPhoto}
            onChange={(value) => setForm({ ...form, askPhoto: value })}
            label={t("requirements.askPhoto")}
            description={t("requirements.askPhotoHint")}
          />
          <Toggle
            checked={form.askText}
            onChange={(value) => setForm({ ...form, askText: value })}
            label={t("requirements.askText")}
            description={t("requirements.askTextHint")}
          />
          <Toggle
            checked={form.required}
            onChange={(value) => setForm({ ...form, required: value })}
            label={t("requirements.requiredLabel")}
            description={t("requirements.requiredHint")}
          />
          <Toggle
            checked={form.applyByDefault}
            onChange={(value) => setForm({ ...form, applyByDefault: value })}
            label={t("requirements.byDefault")}
            description={t("requirements.byDefaultHint")}
          />

          {error && (
            <p role="alert" className="rounded-2xl bg-red-50 p-3 text-sm text-red-700">
              {error}
            </p>
          )}

          <Button type="submit" variant="accent" size="lg" block disabled={busy}>
            {busy && <Loader2 size={18} className="animate-spin" />}
            {t("common.save")}
          </Button>
          {editing && editing !== "new" && (
            <div>
              <Button
                type="button"
                variant="outline"
                size="lg"
                block
                disabled={busy}
                className="border-red-200 text-red-600"
                onClick={() => void remove(editing)}
              >
                <Trash2 size={17} />
                {t("requirements.remove")}
              </Button>
              <p className="mt-2 text-center text-xs text-slate-400">
                {t("requirements.removeHint")}
              </p>
            </div>
          )}
        </form>
      </Sheet>
    </Card>
  );
}

function Tag({
  children,
  strong = false,
}: {
  children: React.ReactNode;
  strong?: boolean;
}) {
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-[11px] font-semibold",
        strong ? "bg-[#071426] text-white" : "bg-slate-100 text-slate-500",
      )}
    >
      {children}
    </span>
  );
}
