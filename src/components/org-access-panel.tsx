"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Copy, Pencil, Shield, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button, Card, fieldClass } from "./ui";
import { useI18n } from "./i18n-provider";

export type AreaOption = { id: string; name: string };

type AccessRequest = {
  id: string;
  role: string;
  status: string;
  createdAt: string;
  departmentId: string | null;
  department: string;
  name: string;
  email: string;
};

const roleLabel: Record<string, string> = {
  admin: "Administrador",
  host: "Anfitrión",
  guard: "Guardia",
};

export function OrgAccessPanel({
  live,
  departments,
  onDepartments,
}: {
  live: boolean;
  departments: AreaOption[];
  onDepartments: (areas: AreaOption[]) => void;
}) {
  const { t } = useI18n();
  const [accessKey, setAccessKey] = useState(live ? "" : "NEXA-DEMO-NOVA");
  const [requests, setRequests] = useState<AccessRequest[]>([]);
  const [platform, setPlatform] = useState(false);
  const [areaName, setAreaName] = useState("");
  const [editing, setEditing] = useState<AreaOption | null>(null);

  useEffect(() => {
    if (!live) return;
    let active = true;

    async function load() {
      const [accessRes, areaRes] = await Promise.all([
        fetch("/api/access/requests", { cache: "no-store" }),
        fetch("/api/departments", { cache: "no-store" }),
      ]);
      if (!active) return;
      if (accessRes.ok) {
        const payload = (await accessRes.json()) as {
          accessKey?: string;
          requests?: AccessRequest[];
        };
        setAccessKey(payload.accessKey ?? "");
        setRequests(payload.requests ?? []);
      }
      if (areaRes.ok) {
        const payload = (await areaRes.json()) as {
          departments?: Array<{ id: string; name: string; active: boolean }>;
        };
        onDepartments(
          (payload.departments ?? [])
            .filter((area) => area.active)
            .map((area) => ({ id: area.id, name: area.name })),
        );
      }
    }

    void fetch("/api/session", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok || !active) return;
        const payload = (await response.json()) as { platformAdmin?: boolean };
        if (active) setPlatform(Boolean(payload.platformAdmin));
      })
      .catch(() => undefined);

    void load();
    const timer = window.setInterval(() => void load(), 4000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [live, onDepartments]);

  const pending = requests.filter((item) => item.status === "pending");

  async function addArea(event: React.FormEvent) {
    event.preventDefault();
    const name = areaName.trim();
    if (name.length < 2) return;
    if (!live) {
      onDepartments([...departments, { id: crypto.randomUUID(), name }]);
      setAreaName("");
      return;
    }
    const response = await fetch("/api/departments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (!response.ok) {
      toast.error(t("departments.createFail"));
      return;
    }
    const payload = (await response.json()) as { department: AreaOption };
    onDepartments([...departments, payload.department]);
    setAreaName("");
  }

  async function renameArea(event: React.FormEvent) {
    event.preventDefault();
    if (!editing) return;
    const name = editing.name.trim();
    if (name.length < 2) return;
    if (live) {
      const response = await fetch("/api/departments", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editing.id, name }),
      });
      if (!response.ok) {
        toast.error(t("departments.updateFail"));
        return;
      }
    }
    onDepartments(
      departments.map((area) => (area.id === editing.id ? { ...area, name } : area)),
    );
    setEditing(null);
    toast.success(t("departments.updated"));
  }

  async function removeArea(area: AreaOption) {
    if (!window.confirm(t("departments.removeConfirm", { name: area.name }))) return;
    if (live) {
      const response = await fetch(`/api/departments?id=${encodeURIComponent(area.id)}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        toast.error(t("departments.removeFail"));
        return;
      }
    }
    onDepartments(departments.filter((item) => item.id !== area.id));
    if (editing?.id === area.id) setEditing(null);
    toast.success(t("departments.removed"));
  }

  return (
    <div className="mb-8 grid gap-4 lg:grid-cols-2">
      <Card className="border-blue-100 bg-blue-50/50 p-5">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-blue-600 text-white">
            <Shield size={18} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-blue-700">{t("team.joinCode")}</p>
            <p className="text-[11px] font-medium uppercase tracking-wide text-blue-500">
              {t("team.joinCodeNote")}
            </p>
          </div>
        </div>
        <p className="mt-3 font-mono text-lg tracking-wide">{accessKey || "—"}</p>
        <p className="mt-2 text-sm leading-6 text-slate-600">{t("team.joinCodeBody")}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            variant="outline"
            disabled={!accessKey}
            onClick={() => {
              void navigator.clipboard.writeText(accessKey);
              toast.success(t("team.joinCodeCopied"));
            }}
          >
            <Copy size={16} />
            {t("team.copyJoinCode")}
          </Button>
          {platform && (
            <Link href="/platform">
              <Button variant="outline">
                <Shield size={16} />
                Consola NEXA
              </Button>
            </Link>
          )}
        </div>
      </Card>

      <Card className="p-5">
        <p className="text-sm font-semibold">{t("departments.title")}</p>
        <p className="mt-2 text-sm leading-6 text-slate-500">{t("departments.lead")}</p>
        {departments.length === 0 ? (
          <p className="mt-3 text-sm text-slate-400">{t("departments.empty")}</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {departments.map((area) =>
              editing?.id === area.id ? (
                <li key={area.id}>
                  <form onSubmit={renameArea} className="flex gap-2">
                    <input
                      autoFocus
                      className={fieldClass}
                      aria-label={t("departments.name")}
                      value={editing.name}
                      onChange={(event) =>
                        setEditing({ id: area.id, name: event.target.value })
                      }
                    />
                    <Button type="submit" variant="outline">
                      {t("common.save")}
                    </Button>
                    <Button type="button" variant="ghost" onClick={() => setEditing(null)}>
                      {t("common.cancel")}
                    </Button>
                  </form>
                </li>
              ) : (
                <li
                  key={area.id}
                  className="flex items-center justify-between gap-2 rounded-2xl bg-slate-50 px-3 py-2"
                >
                  <span className="min-w-0 truncate text-sm font-medium">{area.name}</span>
                  <span className="flex shrink-0 gap-1">
                    <button
                      type="button"
                      onClick={() => setEditing({ id: area.id, name: area.name })}
                      className="inline-flex h-8 items-center gap-1 rounded-xl px-2.5 text-xs font-semibold text-slate-600 hover:bg-white"
                    >
                      <Pencil size={14} />
                      {t("departments.edit")}
                    </button>
                    <button
                      type="button"
                      onClick={() => void removeArea(area)}
                      className="inline-flex h-8 items-center gap-1 rounded-xl px-2.5 text-xs font-semibold text-red-600 hover:bg-white"
                    >
                      <Trash2 size={14} />
                      {t("departments.remove")}
                    </button>
                  </span>
                </li>
              ),
            )}
          </ul>
        )}
        <form onSubmit={addArea} className="mt-4 flex gap-2">
          <input
            className={fieldClass}
            placeholder={t("departments.newPlaceholder")}
            value={areaName}
            onChange={(event) => setAreaName(event.target.value)}
          />
          <Button type="submit" variant="outline">
            {t("departments.add")}
          </Button>
        </form>
      </Card>

      <Card className="p-5 lg:col-span-2">
        <p className="text-sm font-semibold">Solicitudes de acceso</p>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          Aceptar una solicitud ya no da acceso. Invítalos por correo.
        </p>
        {!live && (
          <p className="mt-2 text-sm text-slate-500">
            En demostración no llegan solicitudes.
          </p>
        )}
        {live && pending.length === 0 && (
          <p className="mt-2 text-sm text-slate-500">No hay solicitudes en espera.</p>
        )}
        <ul className="mt-3 space-y-3">
          {requests
            .filter((item) => item.status !== "approved")
            .map((item) => (
              <li
                key={item.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 p-3"
              >
                <div>
                  <p className="font-semibold">
                    {item.name}
                    {item.department ? ` · ${item.department}` : ""}
                  </p>
                  <p className="text-sm text-slate-500">
                    {item.email} · pide ser {roleLabel[item.role] ?? item.role}
                    {item.status === "rejected" ? " · rechazada" : ""}
                  </p>
                </div>
              </li>
            ))}
        </ul>
      </Card>
    </div>
  );
}
