"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button, Card, Field, fieldClass } from "./ui";

type Member = {
  name: string;
  email: string;
  role: string;
  status: string;
  department: string;
};

type Company = {
  id: string;
  name: string;
  accessKey: string;
  serviceStatus: string;
  pendingRequests: number;
  departments: string[];
  members: Member[];
};

export function PlatformConsole() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    name: "",
    locationName: "Recepción principal",
    locationAddress: "",
    adminName: "",
    adminEmail: "",
  });
  const [created, setCreated] = useState<{ accessKey: string; inviteUrl: string } | null>(
    null,
  );

  async function load() {
    const response = await fetch("/api/platform", { cache: "no-store" });
    if (!response.ok) throw new Error("No fue posible cargar las empresas");
    const payload = (await response.json()) as { companies: Company[] };
    setCompanies(payload.companies ?? []);
  }

  useEffect(() => {
    void load()
      .catch((reason) => toast.error(reason instanceof Error ? reason.message : "Error"))
      .finally(() => setLoading(false));
  }, []);

  async function createCompany(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      const response = await fetch("/api/platform", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const payload = (await response.json()) as {
        accessKey?: string;
        inviteUrl?: string;
        error?: string;
      };
      if (!response.ok) throw new Error(payload.error ?? "No fue posible activar");
      setCreated({
        accessKey: payload.accessKey ?? "",
        inviteUrl: payload.inviteUrl ?? "",
      });
      await load();
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  async function patch(organizationId: string, body: Record<string, unknown>) {
    const response = await fetch("/api/platform", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ organizationId, ...body }),
    });
    if (!response.ok) {
      toast.error("No fue posible actualizar");
      return;
    }
    await load();
  }

  if (loading) return <p className="text-sm text-slate-500">Cargando empresas…</p>;

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-semibold text-[#0d9d99]">Consola NEXA</p>
        <Link href="/app" className="mt-2 inline-block text-sm font-semibold text-blue-600">
          Volver a tu empresa
        </Link>
        <h1 className="mt-1 text-3xl font-semibold tracking-[-.03em]">Empresas</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
          Aquí se activa el servicio después del pago. La clave es para que el
          equipo solicite acceso. El primer administrador entra por el correo,
          sin clave, y ya puede aprobar al resto.
        </p>
      </header>

      <Card className="p-5">
        <h2 className="font-semibold">Activar empresa</h2>
        {created ? (
          <div className="mt-4 space-y-2 text-sm">
            <p>
              Clave: <b className="font-mono">{created.accessKey}</b>
            </p>
            <p className="break-all">
              Invitación del administrador: {created.inviteUrl}
            </p>
            <Button variant="outline" onClick={() => setCreated(null)}>
              Activar otra
            </Button>
          </div>
        ) : (
          <form onSubmit={createCompany} className="mt-4 grid gap-3 sm:grid-cols-2">
            <Field label="Empresa">
              <input
                required
                className={fieldClass}
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
              />
            </Field>
            <Field label="Sede">
              <input
                required
                className={fieldClass}
                value={form.locationName}
                onChange={(event) =>
                  setForm({ ...form, locationName: event.target.value })
                }
              />
            </Field>
            <Field label="Dirección">
              <input
                required
                className={fieldClass}
                value={form.locationAddress}
                onChange={(event) =>
                  setForm({ ...form, locationAddress: event.target.value })
                }
              />
            </Field>
            <Field label="Nombre del administrador">
              <input
                required
                className={fieldClass}
                value={form.adminName}
                onChange={(event) =>
                  setForm({ ...form, adminName: event.target.value })
                }
              />
            </Field>
            <Field label="Correo del administrador">
              <input
                required
                type="email"
                className={fieldClass}
                value={form.adminEmail}
                onChange={(event) =>
                  setForm({ ...form, adminEmail: event.target.value })
                }
              />
            </Field>
            <div className="flex items-end">
              <Button type="submit" disabled={busy}>
                {busy ? <Loader2 className="animate-spin" size={16} /> : "Activar y enviar clave"}
              </Button>
            </div>
          </form>
        )}
      </Card>

      <div className="space-y-3">
        {companies.map((company) => (
          <Card key={company.id} className="p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">{company.name}</h2>
                <p className="mt-1 font-mono text-sm text-[#0d9d99]">{company.accessKey}</p>
                <p className="mt-1 text-sm text-slate-500">
                  {company.serviceStatus === "active" ? "Activa" : "En pausa"} ·{" "}
                  {company.members.length} personas · {company.pendingRequests} solicitudes
                  {company.departments.length
                    ? ` · Áreas: ${company.departments.join(", ")}`
                    : ""}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => setOpen(open === company.id ? null : company.id)}>
                  {open === company.id ? "Ocultar" : "Ver gente"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() =>
                    void patch(company.id, {
                      serviceStatus: company.serviceStatus === "active" ? "suspended" : "active",
                    })
                  }
                >
                  {company.serviceStatus === "active" ? "Pausar" : "Reactivar"}
                </Button>
                <Button variant="outline" onClick={() => void patch(company.id, { rotateKey: true })}>
                  Nueva clave
                </Button>
              </div>
            </div>
            {open === company.id && (
              <ul className="mt-4 divide-y divide-slate-100 text-sm">
                {company.members.map((member) => (
                  <li key={`${member.email}-${member.role}`} className="flex justify-between py-2">
                    <span>
                      {member.name}
                      {member.department ? ` · ${member.department}` : ""}
                      <span className="block text-slate-500">{member.email}</span>
                    </span>
                    <span className="text-slate-500">
                      {member.role} · {member.status}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}
