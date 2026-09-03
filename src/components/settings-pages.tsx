"use client";

import { useEffect, useState } from "react";
import {
  Building2,
  Check,
  Clock3,
  Loader2,
  MapPin,
  Plus,
  Shield,
  UserPlus,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { useWorkspace } from "./workspace-provider";
import {
  Avatar,
  Button,
  Callout,
  Card,
  EmptyState,
  Field,
  SectionTitle,
  cn,
  fieldClass,
} from "./ui";
import { Sheet, Toggle } from "./ui-client";
import {
  showcaseLocations,
  showcaseSettings,
  showcaseTeam,
} from "@/lib/demo-data";
import {
  roleLabels,
  type Location,
  type MemberRole,
  type OrganizationSettings,
  type TeamMember,
} from "@/lib/domain";

async function readError(response: Response, fallback: string) {
  try {
    const body = (await response.json()) as { error?: string };
    return body.error ?? fallback;
  } catch {
    return fallback;
  }
}

/* ========================================================================== */
/* Equipo                                                                     */
/* ========================================================================== */

export function TeamPage() {
  const { live, viewer, reload } = useWorkspace();
  const [members, setMembers] = useState<TeamMember[]>(live ? [] : showcaseTeam);
  const [loading, setLoading] = useState(live);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<TeamMember | null>(null);
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    role: "host" as MemberRole,
  });

  useEffect(() => {
    if (!live) return;
    let active = true;

    void (async () => {
      try {
        const response = await fetch("/api/team", { cache: "no-store" });
        if (!response.ok) throw new Error(await readError(response, "Error"));
        const payload = (await response.json()) as { members: TeamMember[] };
        if (active) setMembers(payload.members ?? []);
      } catch (reason) {
        if (active)
          toast.error(
            reason instanceof Error
              ? reason.message
              : "No fue posible cargar el equipo",
          );
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [live]);

  async function invite(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      if (live) {
        const response = await fetch("/api/team", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
        if (!response.ok)
          throw new Error(await readError(response, "No fue posible invitar"));
        const payload = (await response.json()) as { member: TeamMember };
        setMembers((current) => [...current, payload.member]);
      } else {
        setMembers((current) => [
          ...current,
          {
            id: crypto.randomUUID(),
            name: form.fullName,
            email: form.email,
            role: form.role,
            active: true,
          },
        ]);
      }
      toast.success("Invitación enviada");
      setOpen(false);
      setForm({ fullName: "", email: "", role: "host" });
      if (live) void reload();
    } catch (reason) {
      toast.error(
        reason instanceof Error ? reason.message : "No fue posible invitar",
      );
    } finally {
      setBusy(false);
    }
  }

  async function updateMember(member: TeamMember, patch: Partial<TeamMember>) {
    setBusy(true);
    try {
      if (live) {
        const response = await fetch(`/api/team/${member.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role: patch.role, active: patch.active }),
        });
        if (!response.ok)
          throw new Error(await readError(response, "No fue posible actualizar"));
      }
      setMembers((current) =>
        current.map((item) =>
          item.id === member.id ? { ...item, ...patch } : item,
        ),
      );
      toast.success("Acceso actualizado");
      setEditing(null);
    } catch (reason) {
      toast.error(
        reason instanceof Error ? reason.message : "No fue posible actualizar",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <SectionTitle
        eyebrow="Administración"
        title="Equipo"
        description="Quién puede invitar, recibir visitantes y operar la caseta."
        action={
          <Button onClick={() => setOpen(true)}>
            <UserPlus size={17} />
            Invitar
          </Button>
        }
      />

      {loading ? (
        <Card>
          <p className="text-sm text-slate-500">Cargando equipo…</p>
        </Card>
      ) : members.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Todavía estás solo"
          description="Invita a tus anfitriones y al personal de seguridad."
          action={
            <Button variant="accent" onClick={() => setOpen(true)}>
              <UserPlus size={18} />
              Invitar al equipo
            </Button>
          }
        />
      ) : (
        <div className="space-y-2.5">
          {members.map((member) => (
            <Card key={member.id} className="flex items-center gap-3 p-4">
              <Avatar name={member.name} size={44} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">
                  {member.name}
                  {member.id === viewer.id && (
                    <span className="ml-1.5 text-xs font-normal text-slate-400">
                      (tú)
                    </span>
                  )}
                </p>
                <p className="truncate text-sm text-slate-500">{member.email}</p>
              </div>
              <button
                type="button"
                disabled={member.id === viewer.id}
                onClick={() => setEditing(member)}
                className={cn(
                  "shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition",
                  member.active
                    ? "bg-slate-100 text-slate-700"
                    : "bg-amber-50 text-amber-700",
                  member.id !== viewer.id && "active:bg-slate-200",
                )}
              >
                {member.active ? roleLabels[member.role] : "Suspendido"}
              </button>
            </Card>
          ))}
        </div>
      )}

      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title="Invitar al equipo"
        description="Recibirá un correo para definir su contraseña y entrar."
      >
        <form onSubmit={invite} className="space-y-4">
          <Field label="Nombre completo">
            <input
              required
              className={fieldClass}
              value={form.fullName}
              onChange={(event) =>
                setForm({ ...form, fullName: event.target.value })
              }
            />
          </Field>
          <Field label="Correo">
            <input
              required
              type="email"
              className={fieldClass}
              value={form.email}
              onChange={(event) => setForm({ ...form, email: event.target.value })}
            />
          </Field>
          <Field label="Rol">
            <select
              className={fieldClass}
              value={form.role}
              onChange={(event) =>
                setForm({ ...form, role: event.target.value as MemberRole })
              }
            >
              <option value="host">Anfitrión — invita y recibe visitas</option>
              <option value="guard">Guardia — valida accesos en caseta</option>
              <option value="admin">Administración — control total</option>
            </select>
          </Field>
          <Button type="submit" variant="accent" size="lg" block disabled={busy}>
            {busy ? <Loader2 size={18} className="animate-spin" /> : <UserPlus size={18} />}
            Enviar invitación
          </Button>
        </form>
      </Sheet>

      <Sheet
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title={editing?.name ?? ""}
        description="Cambia su rol o suspende su acceso."
      >
        {editing && (
          <div className="space-y-3">
            {(["admin", "host", "guard"] as MemberRole[]).map((role) => (
              <button
                key={role}
                type="button"
                disabled={busy}
                onClick={() => updateMember(editing, { role, active: true })}
                className={cn(
                  "flex w-full items-center justify-between rounded-2xl border p-4 text-left transition",
                  editing.role === role && editing.active
                    ? "border-[#10cfc9] bg-[#10cfc9]/10"
                    : "border-slate-200",
                )}
              >
                <span className="text-sm font-semibold">{roleLabels[role]}</span>
                {editing.role === role && editing.active && (
                  <Check size={18} className="text-[#0d9d99]" />
                )}
              </button>
            ))}
            <Button
              variant={editing.active ? "outline" : "accent"}
              size="lg"
              block
              disabled={busy}
              className={editing.active ? "border-red-200 text-red-600" : ""}
              onClick={() => updateMember(editing, { active: !editing.active })}
            >
              {editing.active ? "Suspender acceso" : "Reactivar acceso"}
            </Button>
          </div>
        )}
      </Sheet>
    </>
  );
}

/* ========================================================================== */
/* Ubicaciones                                                                */
/* ========================================================================== */

export function LocationsPage() {
  const { live, reload } = useWorkspace();
  const [locations, setLocations] = useState<Location[]>(
    live ? [] : showcaseLocations,
  );
  const [loading, setLoading] = useState(live);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    name: "",
    address: "",
    timezone: "America/Mexico_City",
  });

  useEffect(() => {
    if (!live) return;
    let active = true;

    void (async () => {
      try {
        const response = await fetch("/api/locations", { cache: "no-store" });
        if (!response.ok) throw new Error(await readError(response, "Error"));
        const payload = (await response.json()) as { locations: Location[] };
        if (active) setLocations(payload.locations ?? []);
      } catch (reason) {
        if (active)
          toast.error(
            reason instanceof Error
              ? reason.message
              : "No fue posible cargar las ubicaciones",
          );
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [live]);

  async function create(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      if (live) {
        const response = await fetch("/api/locations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
        if (!response.ok)
          throw new Error(await readError(response, "No fue posible crear"));
        const payload = (await response.json()) as { location: Location };
        setLocations((current) => [...current, payload.location]);
      } else {
        setLocations((current) => [
          ...current,
          { id: crypto.randomUUID(), ...form, active: true },
        ]);
      }
      toast.success("Ubicación creada");
      setOpen(false);
      setForm({ name: "", address: "", timezone: "America/Mexico_City" });
      if (live) void reload();
    } catch (reason) {
      toast.error(
        reason instanceof Error ? reason.message : "No fue posible crear",
      );
    } finally {
      setBusy(false);
    }
  }

  async function toggle(location: Location) {
    const active = !location.active;
    try {
      if (live) {
        const response = await fetch(`/api/locations/${location.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ active }),
        });
        if (!response.ok)
          throw new Error(await readError(response, "No fue posible actualizar"));
      }
      setLocations((current) =>
        current.map((item) =>
          item.id === location.id ? { ...item, active } : item,
        ),
      );
      if (live) void reload();
    } catch (reason) {
      toast.error(
        reason instanceof Error ? reason.message : "No fue posible actualizar",
      );
    }
  }

  return (
    <>
      <SectionTitle
        eyebrow="Administración"
        title="Ubicaciones"
        description="Los puntos donde recibes visitantes."
        action={
          <Button onClick={() => setOpen(true)}>
            <Plus size={17} />
            Nueva
          </Button>
        }
      />

      {loading ? (
        <Card>
          <p className="text-sm text-slate-500">Cargando ubicaciones…</p>
        </Card>
      ) : locations.length === 0 ? (
        <EmptyState
          icon={MapPin}
          title="Sin ubicaciones"
          description="Crea al menos una recepción para poder invitar visitantes."
          action={
            <Button variant="accent" onClick={() => setOpen(true)}>
              <Plus size={18} />
              Crear ubicación
            </Button>
          }
        />
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {locations.map((location) => (
            <Card key={location.id} className="p-5">
              <div className="flex items-start gap-4">
                <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-blue-50 text-blue-600">
                  <Building2 size={22} />
                </span>
                <div className="min-w-0 flex-1">
                  <h2 className="truncate font-semibold">{location.name}</h2>
                  <p className="mt-1 text-sm leading-5 text-slate-500">
                    {location.address}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    {location.timezone}
                  </p>
                </div>
                <button
                  onClick={() => toggle(location)}
                  className={cn(
                    "shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition",
                    location.active
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-slate-100 text-slate-500",
                  )}
                >
                  {location.active ? "Activa" : "Inactiva"}
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title="Nueva ubicación"
        description="Aparecerá como opción al crear invitaciones."
      >
        <form onSubmit={create} className="space-y-4">
          <Field label="Nombre">
            <input
              required
              className={fieldClass}
              placeholder="Recepción principal"
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
            />
          </Field>
          <Field label="Dirección">
            <input
              required
              className={fieldClass}
              placeholder="Calle, número, ciudad"
              value={form.address}
              onChange={(event) =>
                setForm({ ...form, address: event.target.value })
              }
            />
          </Field>
          <Field label="Zona horaria">
            <select
              className={fieldClass}
              value={form.timezone}
              onChange={(event) =>
                setForm({ ...form, timezone: event.target.value })
              }
            >
              {[
                "America/Mexico_City",
                "America/Tijuana",
                "America/Monterrey",
                "America/Cancun",
                "America/Bogota",
                "America/Lima",
                "America/Santiago",
                "America/Buenos_Aires",
                "Europe/Madrid",
              ].map((zone) => (
                <option key={zone}>{zone}</option>
              ))}
            </select>
          </Field>
          <Button type="submit" variant="accent" size="lg" block disabled={busy}>
            {busy ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />}
            Crear ubicación
          </Button>
        </form>
      </Sheet>
    </>
  );
}

/* ========================================================================== */
/* Configuración                                                              */
/* ========================================================================== */

export function SettingsPage() {
  const { live, organization, reload } = useWorkspace();
  const [settings, setSettings] = useState<OrganizationSettings>(showcaseSettings);
  const [loading, setLoading] = useState(live);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!live) return;
    let active = true;

    void (async () => {
      try {
        const response = await fetch("/api/settings", { cache: "no-store" });
        if (!response.ok) throw new Error(await readError(response, "Error"));
        const payload = (await response.json()) as {
          settings: OrganizationSettings;
        };
        if (active) setSettings(payload.settings);
      } catch (reason) {
        if (active)
          toast.error(
            reason instanceof Error
              ? reason.message
              : "No fue posible cargar la configuración",
          );
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [live]);

  async function save() {
    setBusy(true);
    try {
      if (live) {
        const response = await fetch("/api/settings", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(settings),
        });
        if (!response.ok)
          throw new Error(await readError(response, "No fue posible guardar"));
        void reload();
      }
      toast.success("Configuración guardada");
    } catch (reason) {
      toast.error(
        reason instanceof Error ? reason.message : "No fue posible guardar",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <SectionTitle
        eyebrow={organization.name}
        title="Configuración"
        description="Privacidad, retención y ventanas de acceso."
      />

      {loading ? (
        <Card>
          <p className="text-sm text-slate-500">Cargando configuración…</p>
        </Card>
      ) : (
        <div className="max-w-3xl space-y-5">
          <Card className="p-5 sm:p-6">
            <h2 className="flex items-center gap-2 font-semibold">
              <Shield size={18} />
              Retención de identificaciones
            </h2>
            <p className="mt-1.5 text-sm text-slate-500">
              Al cumplirse el plazo, la imagen se borra del almacenamiento y queda
              constancia en la bitácora.
            </p>

            <div className="mt-5 flex flex-wrap gap-2">
              {[7, 15, 30, 60, 90].map((days) => (
                <button
                  key={days}
                  type="button"
                  onClick={() =>
                    setSettings({ ...settings, documentRetentionDays: days })
                  }
                  className={cn(
                    "h-11 rounded-2xl border px-4 text-sm font-semibold transition",
                    settings.documentRetentionDays === days
                      ? "border-[#10cfc9] bg-[#10cfc9]/12 text-[#0d9d99]"
                      : "border-slate-200 bg-white text-slate-600",
                  )}
                >
                  {days} días
                </button>
              ))}
            </div>

            <Callout tone="neutral" className="mt-4">
              El plazo se aplica a las identificaciones que se capturen a partir
              de ahora; las ya almacenadas conservan la fecha con la que se
              subieron.
            </Callout>

            <div className="mt-5">
              <Toggle
                checked={settings.allowDocumentPreviewForGuards}
                onChange={(value) =>
                  setSettings({
                    ...settings,
                    allowDocumentPreviewForGuards: value,
                  })
                }
                label="Guardias pueden ver la identificación"
                description="Desactivado minimiza la exposición de datos personales en caseta."
              />
            </div>
          </Card>

          <Card className="p-5 sm:p-6">
            <h2 className="flex items-center gap-2 font-semibold">
              <Clock3 size={18} />
              Ventana de acceso
            </h2>
            <p className="mt-1.5 text-sm text-slate-500">
              Cuánta tolerancia hay antes y después del horario programado. Fuera
              de la ventana, el guardia debe autorizar explícitamente.
            </p>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <Field label="Tolerancia de llegada anticipada">
                <select
                  className={fieldClass}
                  value={settings.earlyEntryMinutes}
                  onChange={(event) =>
                    setSettings({
                      ...settings,
                      earlyEntryMinutes: Number(event.target.value),
                    })
                  }
                >
                  {[0, 10, 15, 30, 60, 120].map((value) => (
                    <option key={value} value={value}>
                      {value === 0 ? "Sin tolerancia" : `${value} minutos antes`}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Tolerancia de llegada tardía">
                <select
                  className={fieldClass}
                  value={settings.lateEntryMinutes}
                  onChange={(event) =>
                    setSettings({
                      ...settings,
                      lateEntryMinutes: Number(event.target.value),
                    })
                  }
                >
                  {[0, 15, 30, 60, 120, 240].map((value) => (
                    <option key={value} value={value}>
                      {value === 0 ? "Sin tolerancia" : `${value} minutos después`}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          </Card>

          <Card className="p-5 sm:p-6">
            <h2 className="flex items-center gap-2 font-semibold">
              <Building2 size={18} />
              Aviso de privacidad
            </h2>
            <p className="mt-1.5 text-sm text-slate-500">
              Es el texto que lee y acepta cada visitante antes de entregar sus
              datos. Al cambiarlo se genera una versión nueva.
            </p>
            <textarea
              rows={7}
              value={settings.privacyNotice}
              onChange={(event) =>
                setSettings({ ...settings, privacyNotice: event.target.value })
              }
              className="mt-4 w-full rounded-2xl border border-slate-200 bg-white p-4 text-[15px] leading-6 outline-none focus:border-[#10aaa5] focus:ring-4 focus:ring-[#10cfc9]/15"
            />
            <p className="mt-2 text-xs text-slate-400">
              Versión vigente: {settings.privacyNoticeVersion} ·{" "}
              {settings.privacyNotice.length} caracteres
            </p>
            <Callout tone="warning" className="mt-4">
              Este texto debe ser revisado por tu área legal antes de operar con
              datos reales.
            </Callout>
          </Card>

          <div className="sticky bottom-[calc(84px+env(safe-area-inset-bottom))] -mx-4 bg-gradient-to-t from-[#f4f7fb] via-[#f4f7fb] to-transparent px-4 pb-2 pt-4 lg:static lg:mx-0 lg:bg-none lg:p-0">
            <Button
              variant="accent"
              size="lg"
              block
              disabled={busy}
              onClick={save}
            >
              {busy ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
              Guardar cambios
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
