"use client";
import { useEffect, useState } from "react";
import {
  Building2,
  Check,
  Plus,
  Shield,
  UserPlus,
  X,
} from "lucide-react";
import { hasSupabaseConfig } from "@/lib/supabase/client";
const isProduction = () =>
  process.env.NEXT_PUBLIC_DEMO_MODE === "false" && hasSupabaseConfig();
type Member = {
  id: string;
  name: string;
  email: string;
  role: string;
  active: boolean;
};
const demoMembers: Member[] = [
  {
    id: "1",
    name: "Elena Torres",
    email: "admin@novalogistics.demo",
    role: "admin",
    active: true,
  },
  {
    id: "2",
    name: "Mateo García",
    email: "mateo@novalogistics.demo",
    role: "host",
    active: true,
  },
  {
    id: "3",
    name: "Valeria Cruz",
    email: "valeria@novalogistics.demo",
    role: "host",
    active: true,
  },
  {
    id: "4",
    name: "Carlos Mendoza",
    email: "guardia1@novalogistics.demo",
    role: "guard",
    active: true,
  },
  {
    id: "5",
    name: "Lucía Herrera",
    email: "guardia2@novalogistics.demo",
    role: "guard",
    active: true,
  },
];
const roleLabel: Record<string, string> = {
  admin: "Administración",
  host: "Anfitrión",
  guard: "Guardia",
};
export function TeamPage() {
  const [members, setMembers] = useState<Member[]>(demoMembers);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ fullName: "", email: "", role: "host" });
  useEffect(() => {
    if (isProduction())
      fetch("/api/team")
        .then((r) => r.json())
        .then(
          (d: { members?: Member[] }) => d.members && setMembers(d.members),
        );
  }, []);
  async function invite(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    if (isProduction()) {
      const response = await fetch("/api/team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = (await response.json()) as {
        member?: Member;
        error?: string;
      };
      if (!response.ok || !data.member) {
        setError(data.error ?? "No fue posible invitar");
        setBusy(false);
        return;
      }
      setMembers((x) => [...x, data.member!]);
    } else
      setMembers((x) => [
        ...x,
        {
          id: crypto.randomUUID(),
          name: form.fullName,
          email: form.email,
          role: form.role,
          active: true,
        },
      ]);
    setBusy(false);
    setOpen(false);
    setForm({ fullName: "", email: "", role: "host" });
  }
  return (
    <>
      <PageHead
        eyebrow="Administración"
        title="Equipo"
        text="Usuarios y permisos de la organización"
      />
      <div className="mb-5 flex justify-end">
        <button
          onClick={() => setOpen(true)}
          className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#071426] px-4 text-sm font-semibold text-white"
        >
          <UserPlus size={17} />
          Invitar usuario
        </button>
      </div>
      <div className="overflow-hidden rounded-2xl border bg-white">
        {members.map((m) => (
          <div
            key={m.id}
            className="flex items-center gap-4 border-b border-slate-100 p-5 last:border-0"
          >
            <span className="grid size-11 place-items-center rounded-full bg-slate-100 font-semibold">
              {m.name
                .split(" ")
                .map((x) => x[0])
                .slice(0, 2)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{m.name}</p>
              <p className="truncate text-sm text-slate-500">{m.email}</p>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium">
              {roleLabel[m.role] ?? m.role}
            </span>
          </div>
        ))}
      </div>
      {open && (
        <Modal close={() => setOpen(false)}>
          <form onSubmit={invite}>
            <h2 className="text-xl font-semibold">Invitar al equipo</h2>
            <p className="mt-1 text-sm text-slate-500">
              Recibirá un correo para definir su contraseña.
            </p>
            <Input
              label="Nombre"
              value={form.fullName}
              onChange={(value) => setForm({ ...form, fullName: value })}
            />
            <Input
              label="Correo"
              type="email"
              value={form.email}
              onChange={(value) => setForm({ ...form, email: value })}
            />
            <label className="mt-4 block text-sm">
              <span className="mb-2 block font-medium">Rol</span>
              <select
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
                className="h-11 w-full rounded-xl border px-3"
              >
                <option value="host">Anfitrión</option>
                <option value="guard">Guardia</option>
                <option value="admin">Administración</option>
              </select>
            </label>
            {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
            <button
              disabled={busy}
              className="mt-5 h-11 w-full rounded-xl bg-[#071426] font-semibold text-white"
            >
              {busy ? "Enviando…" : "Enviar invitación"}
            </button>
          </form>
        </Modal>
      )}
    </>
  );
}
type Location = {
  id: string;
  name: string;
  address: string;
  timezone: string;
  active: boolean;
};
const demoLocation: Location = {
  id: "demo",
  name: "Centro de Distribución Tijuana",
  address: "Blvd. Industrial 2400, Tijuana, B.C.",
  timezone: "America/Tijuana",
  active: true,
};
export function LocationsPage() {
  const [locations, setLocations] = useState<Location[]>([demoLocation]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    address: "",
    timezone: "America/Tijuana",
  });
  useEffect(() => {
    if (isProduction())
      fetch("/api/locations")
        .then((r) => r.json())
        .then(
          (d: { locations?: Location[] }) =>
            d.locations && setLocations(d.locations),
        );
  }, []);
  async function toggle(item: Location) {
    const active = !item.active;
    setLocations((rows) =>
      rows.map((row) => (row.id === item.id ? { ...row, active } : row)),
    );
    if (isProduction())
      await fetch(`/api/locations/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active }),
      });
  }
  async function create(e: React.FormEvent) {
    e.preventDefault();
    let location: Location = { id: crypto.randomUUID(), ...form, active: true };
    if (isProduction()) {
      const response = await fetch("/api/locations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = (await response.json()) as { location?: Location };
      if (!response.ok || !data.location) return;
      location = data.location;
    }
    setLocations((rows) => [...rows, location]);
    setOpen(false);
  }
  return (
    <>
      <PageHead
        eyebrow="Administración"
        title="Ubicaciones"
        text="Puntos donde se reciben visitantes"
      />
      <div className="mb-5 flex justify-end">
        <button
          onClick={() => setOpen(true)}
          className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#071426] px-4 text-sm font-semibold text-white"
        >
          <Plus size={17} />
          Nueva ubicación
        </button>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {locations.map((item) => (
          <article key={item.id} className="rounded-2xl border bg-white p-6">
            <div className="flex items-start gap-4">
              <span className="grid size-12 place-items-center rounded-xl bg-blue-50 text-blue-600">
                <Building2 />
              </span>
              <div className="flex-1">
                <h2 className="font-semibold">{item.name}</h2>
                <p className="mt-1 text-sm text-slate-500">{item.address}</p>
                <p className="mt-1 text-xs text-slate-400">{item.timezone}</p>
              </div>
              <button
                onClick={() => toggle(item)}
                className={`rounded-full px-3 py-1 text-xs font-semibold ${item.active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100"}`}
              >
                {item.active ? "Activa" : "Inactiva"}
              </button>
            </div>
          </article>
        ))}
      </div>
      {open && (
        <Modal close={() => setOpen(false)}>
          <form onSubmit={create}>
            <h2 className="text-xl font-semibold">Nueva ubicación</h2>
            <Input
              label="Nombre"
              value={form.name}
              onChange={(value) => setForm({ ...form, name: value })}
            />
            <Input
              label="Dirección"
              value={form.address}
              onChange={(value) => setForm({ ...form, address: value })}
            />
            <Input
              label="Zona horaria"
              value={form.timezone}
              onChange={(value) => setForm({ ...form, timezone: value })}
            />
            <button className="mt-5 h-11 w-full rounded-xl bg-[#071426] font-semibold text-white">
              Crear ubicación
            </button>
          </form>
        </Modal>
      )}
    </>
  );
}
export function SettingsPage() {
  const [days, setDays] = useState(30);
  const [preview, setPreview] = useState(false);
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    if (isProduction())
      fetch("/api/settings")
        .then((r) => r.json())
        .then(
          (d: {
            settings?: {
              documentRetentionDays: number;
              allowDocumentPreviewForGuards: boolean;
            };
          }) => {
            if (d.settings) {
              setDays(d.settings.documentRetentionDays);
              setPreview(d.settings.allowDocumentPreviewForGuards);
            }
          },
        );
  }, []);
  async function save() {
    if (isProduction()) {
      const response = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentRetentionDays: days,
          allowDocumentPreviewForGuards: preview,
        }),
      });
      if (!response.ok) return;
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  }
  return (
    <>
      <PageHead
        eyebrow="Organización"
        title="Configuración"
        text="Privacidad, seguridad y operación"
      />
      <div className="max-w-3xl space-y-5">
        <section className="rounded-2xl border bg-white p-6">
          <h2 className="flex items-center gap-2 font-semibold">
            <Shield size={18} />
            Retención y privacidad
          </h2>
          <label className="mt-5 block text-sm">
            <span className="mb-2 block font-medium">
              Eliminar identificaciones después de
            </span>
            <select
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
              className="h-11 w-full rounded-xl border px-3"
            >
              <option value={7}>7 días</option>
              <option value={30}>30 días</option>
              <option value={90}>90 días</option>
            </select>
          </label>
          <label className="mt-5 flex items-center justify-between gap-4 rounded-xl bg-slate-50 p-4 text-sm">
            <span>
              <b>Vista de documento para guardias</b>
              <small className="mt-1 block text-slate-500">
                Desactivado minimiza la exposición de datos.
              </small>
            </span>
            <input
              type="checkbox"
              checked={preview}
              onChange={(e) => setPreview(e.target.checked)}
              className="size-5 accent-[#10aaa5]"
            />
          </label>
          <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-800">
            El aviso de privacidad de este MVP debe ser revisado legalmente
            antes de producción.
          </div>
        </section>
        <button
          onClick={save}
          className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#071426] px-5 text-sm font-semibold text-white"
        >
          {saved && <Check size={17} />}{" "}
          {saved ? "Guardado" : "Guardar cambios"}
        </button>
      </div>
    </>
  );
}
function PageHead({
  eyebrow,
  title,
  text,
}: {
  eyebrow: string;
  title: string;
  text: string;
}) {
  return (
    <header className="mb-8">
      <p className="mb-2 text-sm font-medium text-[#0eaaa5]">{eyebrow}</p>
      <h1 className="text-3xl font-semibold tracking-[-.03em]">{title}</h1>
      <p className="mt-2 text-slate-500">{text}</p>
    </header>
  );
}
function Input({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <label className="mt-4 block text-sm">
      <span className="mb-2 block font-medium">{label}</span>
      <input
        required
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-11 w-full rounded-xl border px-3 outline-none focus:border-[#10aaa5]"
      />
    </label>
  );
}
function Modal({
  children,
  close,
}: {
  children: React.ReactNode;
  close: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4">
      <div className="relative w-full max-w-md rounded-3xl bg-white p-6 shadow-xl">
        <button
          aria-label="Cerrar"
          onClick={close}
          className="absolute right-5 top-5 rounded-lg p-1 text-slate-400"
        >
          <X />
        </button>
        {children}
      </div>
    </div>
  );
}
