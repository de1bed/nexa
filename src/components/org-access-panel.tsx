"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Copy, Shield } from "lucide-react";
import { toast } from "sonner";
import { Button, Card, Field, fieldClass } from "./ui";

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
  const [accessKey, setAccessKey] = useState(live ? "" : "NEXA-DEMO-NOVA");
  const [requests, setRequests] = useState<AccessRequest[]>([]);
  const [platform, setPlatform] = useState(false);
  const [areaName, setAreaName] = useState("");

  useEffect(() => {
    if (!live) return;
    let active = true;

    async function load() {
      const [accessRes, areaRes, platformRes] = await Promise.all([
        fetch("/api/access/requests", { cache: "no-store" }),
        fetch("/api/departments", { cache: "no-store" }),
        fetch("/api/platform?probe=1", { cache: "no-store" }),
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
      setPlatform(platformRes.ok);
    }

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
      toast.error("No fue posible crear el área");
      return;
    }
    const payload = (await response.json()) as { department: AreaOption };
    onDepartments([...departments, payload.department]);
    setAreaName("");
  }

  return (
    <div className="mb-8 grid gap-4 lg:grid-cols-2">
      <Card className="p-5">
        <p className="text-sm font-semibold text-[#0d9d99]">Clave de la empresa</p>
        <p className="mt-2 font-mono text-lg tracking-wide">{accessKey || "—"}</p>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          La clave ya no deja entrar a nadie. La gente entra solo si la invitas
          por correo.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            variant="outline"
            disabled={!accessKey}
            onClick={() => {
              void navigator.clipboard.writeText(accessKey);
              toast.success("Clave copiada");
            }}
          >
            <Copy size={16} />
            Copiar clave
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
        <p className="text-sm font-semibold">Áreas</p>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          El nombre y el área identifican a cada persona del equipo.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {departments.length === 0 && (
            <span className="text-sm text-slate-400">Todavía no hay áreas.</span>
          )}
          {departments.map((area) => (
            <span
              key={area.id}
              className="rounded-full bg-slate-100 px-3 py-1 text-sm font-medium"
            >
              {area.name}
            </span>
          ))}
        </div>
        <form onSubmit={addArea} className="mt-4 flex gap-2">
          <input
            className={fieldClass}
            placeholder="Nueva área"
            value={areaName}
            onChange={(event) => setAreaName(event.target.value)}
          />
          <Button type="submit" variant="outline">
            Agregar
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
