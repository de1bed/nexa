"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Building2,
  Check,
  ChevronRight,
  Clock3,
  Copy,
  IdCard,
  KeyRound,
  Loader2,
  MapPin,
  Plus,
  ScanLine,
  Shield,
  Trash2,
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
import { Sheet, Toggle, CopyField, ShareButton } from "./ui-client";
import { AddressField } from "./address-field";
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
import { appUrl } from "@/lib/config";

type JoinCode = {
  id: string;
  code: string;
  role: MemberRole;
  uses_remaining: number | null;
  expires_at: string | null;
  created_at: string;
};

async function readError(response: Response, fallback: string) {
  try {
    const body = (await response.json()) as { error?: string };
    return body.error ?? fallback;
  } catch {
    return fallback;
  }
}

function formatTimeSince(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffDays < 1) return "Hoy";
  if (diffDays === 1) return "1 día";
  if (diffDays < 7) return `${diffDays} días`;
  if (diffDays < 30) {
    const weeks = Math.floor(diffDays / 7);
    return weeks === 1 ? "1 semana" : `${weeks} semanas`;
  }
  if (diffDays < 365) {
    const months = Math.floor(diffDays / 30);
    return months === 1 ? "1 mes" : `${months} meses`;
  }
  const years = Math.floor(diffDays / 365);
  return years === 1 ? "1 año" : `${years} años`;
}

/* ========================================================================== */
/* Equipo                                                                     */
/* ========================================================================== */

export function TeamPage() {
  const { live, viewer, reload } = useWorkspace();
  const [members, setMembers] = useState<TeamMember[]>(live ? [] : showcaseTeam);
  const [joinCodes, setJoinCodes] = useState<JoinCode[]>([]);
  const [loading, setLoading] = useState(live);
  const [open, setOpen] = useState(false);
  const [codeOpen, setCodeOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<TeamMember | null>(null);
  const [result, setResult] = useState<{
    member: TeamMember;
    delivery: "sent" | "development" | "failed";
    loginUrl: string;
    createdAccount: boolean;
    otp?: string;
  } | null>(null);
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    role: "host" as MemberRole,
  });
  const [codeForm, setCodeForm] = useState({
    role: "host" as MemberRole,
    usesLimit: undefined as number | undefined,
    expiresInDays: 7 as number | undefined,
  });

  useEffect(() => {
    if (!live) return;
    let active = true;

    void (async () => {
      try {
        const [teamRes, codesRes] = await Promise.all([
          fetch("/api/team", { cache: "no-store" }),
          fetch("/api/join-codes", { cache: "no-store" }),
        ]);
        if (!teamRes.ok) throw new Error(await readError(teamRes, "Error"));
        const teamPayload = (await teamRes.json()) as { members: TeamMember[] };
        if (active) setMembers(teamPayload.members ?? []);

        if (codesRes.ok) {
          const codesPayload = (await codesRes.json()) as { codes: JoinCode[] };
          if (active) setJoinCodes(codesPayload.codes ?? []);
        }
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
        const payload = (await response.json()) as {
          member: TeamMember;
          delivery: "sent" | "development" | "failed";
          loginUrl: string;
          createdAccount: boolean;
          otp?: string;
        };
        setMembers((current) => {
          if (current.some((item) => item.id === payload.member.id))
            return current.map((item) =>
              item.id === payload.member.id ? payload.member : item,
            );
          return [...current, payload.member];
        });
        setResult(payload);
      } else {
        const member: TeamMember = {
          id: crypto.randomUUID(),
          name: form.fullName,
          email: form.email,
          role: form.role,
          active: true,
        };
        setMembers((current) => [...current, member]);
        setResult({
          member,
          delivery: "development",
          loginUrl: `${window.location.origin}/login`,
          createdAccount: true,
        });
      }
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

  async function createJoinCode(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      const response = await fetch("/api/join-codes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(codeForm),
      });
      if (!response.ok)
        throw new Error(await readError(response, "No fue posible crear el código"));
      const payload = (await response.json()) as { code: JoinCode };
      setJoinCodes((current) => [payload.code, ...current]);
      toast.success("Código creado");
      setCodeOpen(false);
      setCodeForm({ role: "host", usesLimit: undefined, expiresInDays: 7 });
    } catch (reason) {
      toast.error(
        reason instanceof Error ? reason.message : "No fue posible crear el código",
      );
    } finally {
      setBusy(false);
    }
  }

  async function revokeCode(codeId: string) {
    try {
      const response = await fetch("/api/join-codes", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ codeId }),
      });
      if (!response.ok)
        throw new Error(await readError(response, "No fue posible revocar el código"));
      setJoinCodes((current) => current.filter((c) => c.id !== codeId));
      toast.success("Código revocado");
    } catch (reason) {
      toast.error(
        reason instanceof Error ? reason.message : "No fue posible revocar",
      );
    }
  }

  function copyJoinLink(code: string) {
    const url = `${appUrl()}/join?code=${code}`;
    navigator.clipboard.writeText(url);
    toast.success("Enlace copiado");
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
          <div className="flex flex-wrap gap-2">
            <Link href="/guard/scan">
              <Button variant="outline">
                <ScanLine size={17} />
                Abrir caseta
              </Button>
            </Link>
            <Button variant="outline" onClick={() => setCodeOpen(true)}>
              <KeyRound size={17} />
              Código
            </Button>
            <Button
              onClick={() => {
                setResult(null);
                setOpen(true);
              }}
            >
              <UserPlus size={17} />
              Invitar
            </Button>
          </div>
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
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button variant="outline" onClick={() => setCodeOpen(true)}>
                <KeyRound size={18} />
                Crear código
              </Button>
              <Button
                variant="accent"
                onClick={() => {
                  setResult(null);
                  setOpen(true);
                }}
              >
                <UserPlus size={18} />
                Invitar por correo
              </Button>
            </div>
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

      {/* Sección de códigos de invitación */}
      {live && joinCodes.length > 0 && (
        <div className="mt-8">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700">
            <KeyRound size={16} />
            Códigos de invitación activos
          </h3>
          <div className="space-y-2">
            {joinCodes.map((jc) => (
              <Card key={jc.id} className="flex items-center gap-3 p-3">
                <code className="rounded-lg bg-slate-100 px-3 py-1.5 font-mono text-sm font-semibold tracking-wider">
                  {jc.code}
                </code>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{roleLabels[jc.role]}</p>
                  <p className="text-xs text-slate-500">
                    {jc.uses_remaining !== null
                      ? `${jc.uses_remaining} usos restantes`
                      : "Usos ilimitados"}
                    {jc.expires_at &&
                      ` · Vence ${new Date(jc.expires_at).toLocaleDateString("es-MX")}`}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => copyJoinLink(jc.code)}
                  className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100"
                  title="Copiar enlace"
                >
                  <Copy size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => revokeCode(jc.id)}
                  className="rounded-lg p-2 text-red-500 transition hover:bg-red-50"
                  title="Revocar"
                >
                  <Trash2 size={16} />
                </button>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Sheet para invitar por correo */}
      <Sheet
        open={open}
        onClose={() => {
          setOpen(false);
          setResult(null);
        }}
        title={result ? `${result.member.name} ya está en el equipo` : "Invitar al equipo"}
        description={
          result
            ? result.delivery === "sent"
              ? `Le enviamos el acceso a ${result.member.email}.`
              : "La cuenta quedó lista. El correo no salió; comparte el enlace (y el código, si aparece)."
            : "Recibirá un correo con la liga de acceso y, si es cuenta nueva, un código de seis dígitos."
        }
      >
        {result ? (
          <div className="space-y-4">
            {result.delivery === "sent" ? (
              <Callout tone="success">
                Correo enviado. Si no llega en un minuto, revisa spam o comparte
                el enlace de abajo.
              </Callout>
            ) : live ? (
              <Callout tone="warning">
                {result.delivery === "development"
                  ? "No hay clave de Resend, así que el correo se registró en la consola del servidor."
                  : "El correo no se pudo entregar. Comparte el enlace para que esa persona entre."}
              </Callout>
            ) : (
              <Callout tone="neutral">
                En demostración no se envían correos. Para probar el portal de
                guardia abre la caseta ahora, o cierra sesión y elige Guardia.
              </Callout>
            )}

            {result.otp && (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-5 text-center">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Código de acceso
                </p>
                <p className="mt-2 font-mono text-[28px] font-semibold tracking-[.28em] text-[#071426]">
                  {result.otp}
                </p>
                <p className="mt-2 text-xs text-slate-500">
                  Vence en una hora. Compártelo solo con {result.member.name}.
                </p>
              </div>
            )}

            <CopyField value={result.loginUrl} label="Enlace de acceso" />

            <ShareButton
              url={result.loginUrl}
              title={`Acceso a ${result.member.role === "guard" ? "caseta" : "NEXA VISIT"}`}
              text={
                result.otp
                  ? `Te dieron acceso como ${roleLabels[result.member.role]}. Entra con este enlace y el código ${result.otp}:`
                  : `Te dieron acceso como ${roleLabels[result.member.role]}. Entra aquí:`
              }
              className="w-full"
            >
              Compartir por WhatsApp o correo
            </ShareButton>

            <Link href="/guard/scan" className="block">
              <Button variant="outline" size="lg" block>
                <ScanLine size={18} />
                Probar la caseta ahora
              </Button>
            </Link>

            <Button
              variant="ghost"
              block
              onClick={() => {
                setResult(null);
                setForm({ fullName: "", email: "", role: "host" });
              }}
            >
              Invitar a otra persona
            </Button>
          </div>
        ) : (
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
              onChange={(event) =>
                setForm({ ...form, email: event.target.value })
              }
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
          <Callout tone="neutral">
            Si el correo no llega, crea un código de invitación y comparte el enlace manualmente.
          </Callout>
        </form>
        )}
      </Sheet>

      {/* Sheet para crear código */}
      <Sheet
        open={codeOpen}
        onClose={() => setCodeOpen(false)}
        title="Crear código de invitación"
        description="Cualquier persona con cuenta puede usar el código para unirse a tu equipo."
      >
        <form onSubmit={createJoinCode} className="space-y-4">
          <Field label="Rol asignado">
            <select
              className={fieldClass}
              value={codeForm.role}
              onChange={(e) =>
                setCodeForm({ ...codeForm, role: e.target.value as MemberRole })
              }
            >
              <option value="host">Anfitrión</option>
              <option value="guard">Guardia</option>
            </select>
          </Field>
          <Field label="Vigencia" hint="Después de este tiempo el código expira.">
            <select
              className={fieldClass}
              value={codeForm.expiresInDays ?? ""}
              onChange={(e) =>
                setCodeForm({
                  ...codeForm,
                  expiresInDays: e.target.value ? Number(e.target.value) : undefined,
                })
              }
            >
              <option value="1">1 día</option>
              <option value="7">7 días</option>
              <option value="14">14 días</option>
              <option value="30">30 días</option>
              <option value="">Sin vencimiento</option>
            </select>
          </Field>
          <Field label="Límite de usos" hint="Opcional: máximo de personas que pueden usarlo.">
            <input
              type="number"
              className={fieldClass}
              placeholder="Sin límite"
              min={1}
              max={100}
              value={codeForm.usesLimit ?? ""}
              onChange={(e) =>
                setCodeForm({
                  ...codeForm,
                  usesLimit: e.target.value ? Number(e.target.value) : undefined,
                })
              }
            />
          </Field>
          <Button type="submit" variant="accent" size="lg" block disabled={busy}>
            {busy ? <Loader2 size={18} className="animate-spin" /> : <KeyRound size={18} />}
            Crear código
          </Button>
          <p className="text-center text-xs text-slate-500">
            Comparte el código o el enlace con quien quieras invitar
          </p>
        </form>
      </Sheet>

      {/* Sheet para ver/editar miembro */}
      <Sheet
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title={editing?.name ?? ""}
        description="Información y permisos del miembro."
      >
        {editing && (
          <div className="space-y-5">
            {/* Información del miembro */}
            <div className="rounded-2xl bg-slate-50 p-4 space-y-3">
              <div className="flex items-center gap-3">
                <Avatar name={editing.name} size={48} />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold truncate">{editing.name}</p>
                  <p className="text-sm text-slate-500 truncate">{editing.email}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-200">
                <div>
                  <p className="text-xs text-slate-400">Rol actual</p>
                  <p className="text-sm font-medium">{roleLabels[editing.role]}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Estado</p>
                  <p className={cn("text-sm font-medium", editing.active ? "text-emerald-600" : "text-amber-600")}>
                    {editing.active ? "Activo" : "Suspendido"}
                  </p>
                </div>
                {editing.joinedAt && (
                  <>
                    <div>
                      <p className="text-xs text-slate-400">Miembro desde</p>
                      <p className="text-sm font-medium">
                        {new Date(editing.joinedAt).toLocaleDateString("es-MX", { 
                          year: "numeric", 
                          month: "short", 
                          day: "numeric" 
                        })}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400">Antigüedad</p>
                      <p className="text-sm font-medium">
                        {formatTimeSince(editing.joinedAt)}
                      </p>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Cambiar rol */}
            <div>
              <p className="text-sm font-medium text-slate-700 mb-2">Cambiar rol</p>
              <div className="space-y-2">
                {(["admin", "host", "guard"] as MemberRole[]).map((role) => (
                  <button
                    key={role}
                    type="button"
                    disabled={busy || editing.id === viewer.id}
                    onClick={() => updateMember(editing, { role, active: true })}
                    className={cn(
                      "flex w-full items-center justify-between rounded-2xl border p-4 text-left transition",
                      editing.role === role && editing.active
                        ? "border-[#10cfc9] bg-[#10cfc9]/10"
                        : "border-slate-200",
                      editing.id === viewer.id && "opacity-50 cursor-not-allowed",
                    )}
                  >
                    <span className="text-sm font-semibold">{roleLabels[role]}</span>
                    {editing.role === role && editing.active && (
                      <Check size={18} className="text-[#0d9d99]" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            {editing.id !== viewer.id && (
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
            )}
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
          <AddressField
            value={form.address}
            onChange={(address) => setForm({ ...form, address })}
          />
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
        description="Privacidad, qué le pides al visitante y ventanas de acceso."
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-2">
        <Link
          href="/app/team"
          className="flex items-center gap-3 rounded-[22px] border border-slate-200 bg-white p-4 transition active:bg-slate-50"
        >
          <span className="grid size-11 place-items-center rounded-2xl bg-[#071426] text-white">
            <Users size={19} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-semibold">Equipo</span>
            <span className="block text-sm text-slate-500">
              Invita anfitriones y guardias
            </span>
          </span>
          <ChevronRight size={18} className="text-slate-400" />
        </Link>
        <Link
          href="/app/locations"
          className="flex items-center gap-3 rounded-[22px] border border-slate-200 bg-white p-4 transition active:bg-slate-50"
        >
          <span className="grid size-11 place-items-center rounded-2xl bg-[#10cfc9]/15 text-[#0d9d99]">
            <MapPin size={19} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-semibold">Ubicaciones</span>
            <span className="block text-sm text-slate-500">
              Sedes donde recibes visitas
            </span>
          </span>
          <ChevronRight size={18} className="text-slate-400" />
        </Link>
      </div>

      {loading ? (
        <Card>
          <p className="text-sm text-slate-500">Cargando configuración…</p>
        </Card>
      ) : (
        <div className="max-w-3xl space-y-5">
          <Card className="p-5 sm:p-6">
            <h2 className="flex items-center gap-2 font-semibold">
              <IdCard size={18} />
              Qué le pides al visitante
            </h2>
            <p className="mt-1.5 text-sm text-slate-500">
              Si la empresa no quiere guardar identificaciones, el visitante
              solo confirma sus datos y recibe el pase.
            </p>
            <div className="mt-5">
              <Toggle
                checked={settings.requireIdentification}
                onChange={(value) =>
                  setSettings({ ...settings, requireIdentification: value })
                }
                label="Pedir foto de identificación"
                description="Desactívalo si basta con nombre, correo y empresa. El visitante verá que es política de esta organización."
              />
            </div>
          </Card>

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
