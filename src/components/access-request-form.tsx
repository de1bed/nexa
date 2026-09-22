"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Loader2 } from "lucide-react";
import { Brand } from "./brand";
import { Button, Field, fieldClass } from "./ui";
import { roleHome } from "@/lib/config";
import type { MemberRole } from "@/lib/domain";

type Area = { id: string; name: string };

const roles: Array<{ id: "host" | "guard" | "admin"; label: string; hint: string }> = [
  { id: "host", label: "Anfitrión", hint: "Invita y recibe visitas" },
  { id: "guard", label: "Guardia", hint: "Valida el acceso en caseta" },
  { id: "admin", label: "Administrador", hint: "Configura la empresa y al equipo" },
];

export function AccessRequestForm() {
  const router = useRouter();
  const [key, setKey] = useState("");
  const [role, setRole] = useState<"host" | "guard" | "admin">("host");
  const [departmentId, setDepartmentId] = useState("");
  const [organizationName, setOrganizationName] = useState("");
  const [areas, setAreas] = useState<Area[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function lookup(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/access/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key }),
      });
      const payload = (await response.json()) as {
        state?: string;
        organizationName?: string;
        departments?: Area[];
        error?: string;
      };
      if (!response.ok || payload.state !== "ok")
        throw new Error(payload.error ?? "Esa clave no corresponde a una empresa activa.");
      setOrganizationName(payload.organizationName ?? "");
      setAreas(payload.departments ?? []);
      setDepartmentId(payload.departments?.[0]?.id ?? "");
    } catch (reason) {
      setOrganizationName("");
      setAreas([]);
      setError(reason instanceof Error ? reason.message : "Clave inválida");
    } finally {
      setBusy(false);
    }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/access/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key,
          role,
          departmentId: departmentId || null,
        }),
      });
      const payload = (await response.json()) as {
        state?: string;
        organizationId?: string;
        role?: MemberRole;
        error?: string;
      };
      if (!response.ok) throw new Error(payload.error ?? "No fue posible enviar la solicitud");
      if (payload.state === "active" && payload.organizationId && payload.role) {
        await fetch("/api/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ organizationId: payload.organizationId }),
        });
        router.push(roleHome[payload.role]);
        router.refresh();
        return;
      }
      if (payload.state === "invited") {
        throw new Error("Ya tienes una invitación por correo. Ábrela y elige tu contraseña.");
      }
      router.push("/espera");
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No fue posible enviar la solicitud");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="safe-top min-h-screen bg-[#f4f7fb] px-5 py-10">
      <div className="mx-auto w-full max-w-md rounded-[26px] border border-slate-200 bg-white p-6 sm:p-8">
        <Brand />
        <header className="mt-8">
          <p className="text-sm font-semibold text-[#0d9d99]">Solicitar acceso</p>
          <h1 className="mt-2 text-[30px] font-semibold tracking-[-.03em]">
            Clave de tu empresa
          </h1>
          <p className="mt-3 text-[15px] leading-6 text-slate-500">
            La clave la entrega NEXA al iniciar el servicio. Con ella pides entrar.
            Tu administrador decide el rol antes de que puedas usar la plataforma.
          </p>
        </header>

        {!organizationName ? (
          <form onSubmit={lookup} className="mt-7 space-y-4">
            <Field label="Clave de la empresa" hint="Ejemplo: NEXA-AB2K-7QPM">
              <input
                required
                className={fieldClass}
                autoCapitalize="characters"
                value={key}
                onChange={(event) => setKey(event.target.value)}
              />
            </Field>
            {error && <p className="rounded-2xl bg-red-50 p-3.5 text-sm text-red-700">{error}</p>}
            <Button type="submit" size="lg" block disabled={busy}>
              {busy ? <Loader2 className="animate-spin" size={18} /> : "Continuar"}
              <ArrowRight size={18} />
            </Button>
          </form>
        ) : (
          <form onSubmit={submit} className="mt-7 space-y-4">
            <p className="rounded-2xl bg-slate-50 p-4 text-sm">
              Empresa: <b>{organizationName}</b>
            </p>
            <fieldset className="space-y-2">
              <legend className="mb-2 text-sm font-medium">Rol que solicitas</legend>
              {roles.map((item) => (
                <label
                  key={item.id}
                  className="flex cursor-pointer items-center justify-between rounded-2xl border border-slate-200 p-3"
                >
                  <span>
                    <span className="block text-sm font-semibold">{item.label}</span>
                    <span className="text-xs text-slate-500">{item.hint}</span>
                  </span>
                  <input
                    type="radio"
                    name="role"
                    checked={role === item.id}
                    onChange={() => setRole(item.id)}
                  />
                </label>
              ))}
            </fieldset>
            {areas.length > 0 && (
              <Field label="Área">
                <select
                  required
                  className={fieldClass}
                  value={departmentId}
                  onChange={(event) => setDepartmentId(event.target.value)}
                >
                  {areas.map((area) => (
                    <option key={area.id} value={area.id}>
                      {area.name}
                    </option>
                  ))}
                </select>
              </Field>
            )}
            {error && <p className="rounded-2xl bg-red-50 p-3.5 text-sm text-red-700">{error}</p>}
            <Button type="submit" size="lg" block disabled={busy}>
              {busy ? <Loader2 className="animate-spin" size={18} /> : "Enviar solicitud"}
            </Button>
            <button
              type="button"
              className="w-full text-sm text-slate-500"
              onClick={() => {
                setOrganizationName("");
                setError("");
              }}
            >
              Usar otra clave
            </button>
          </form>
        )}

        <p className="mt-6 text-center text-sm text-slate-500">
          <Link href="/login" className="font-semibold text-blue-600">
            Volver a iniciar sesión
          </Link>
        </p>
      </div>
    </main>
  );
}
