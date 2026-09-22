"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Copy, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button, Card, Field, fieldClass } from "./ui";

type Member = {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  department: string;
  joinedAt: string | null;
};

type Payment = {
  id: string;
  amount: number;
  currency: string;
  paidOn: string;
  method: string;
  reference: string;
  concept: string;
};

type AccessRequest = {
  id: string;
  organizationId: string;
  organizationName: string;
  name: string;
  email: string;
  role: string;
  createdAt: string;
};

type Panel = "datos" | "gente" | "visitas" | "pagos" | "solicitudes" | "movimientos" | "ficha";

type LogEvent = {
  id: string;
  organizationId: string;
  organizationName: string;
  actorName: string;
  summary: string;
  createdAt: string;
};

type Company = {
  id: string;
  name: string;
  accessKey: string;
  serviceStatus: string;
  archivedAt: string | null;
  createdAt: string;
  pendingRequests: number;
  departments: string[];
  locations: Array<{ id: string; name: string; address: string }>;
  visits: number;
  visitsThisMonth: number;
  visitsToday: number;
  lastVisitAt: string | null;
  invitePending: boolean;
  recentVisits: Array<{
    id: string;
    visitor: string;
    host: string;
    purpose: string;
    status: string;
    startsAt: string;
  }>;
  planName: string;
  monthlyAmount: number | null;
  currency: string;
  billingEmail: string;
  notes: string;
  payments: Payment[];
  members: Member[];
};

const roleLabel: Record<string, string> = {
  superadmin: "Superadmin",
  admin: "Administrador",
  host: "Anfitrión",
  guard: "Guardia",
};

const statusLabel: Record<string, string> = {
  active: "Dentro",
  invited: "Invitación pendiente",
  suspended: "Suspendido",
};

const visitStatusLabel: Record<string, string> = {
  draft: "Borrador",
  invited: "Invitada",
  pre_registered: "Preregistro",
  approved: "Aprobada",
  checked_in: "Dentro",
  checked_out: "Salió",
  denied: "Negada",
  cancelled: "Cancelada",
  expired: "Vencida",
};

function todayKey() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Mexico_City",
  }).format(new Date());
}

function money(amount: number, currency: string) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(amount);
}

function stamp(value: string) {
  return new Date(value).toLocaleString("es-MX", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function isQuiet(company: Company) {
  if (company.archivedAt || company.invitePending || company.serviceStatus !== "active")
    return false;
  if (!company.lastVisitAt) return true;
  return Date.now() - new Date(company.lastVisitAt).getTime() > 14 * 24 * 60 * 60 * 1000;
}

function activityLabel(company: Company) {
  if (company.invitePending) return "Invitación sin abrir";
  if (company.visitsToday > 0) return "En uso hoy";
  if (isQuiet(company)) return "Quieta";
  if (company.serviceStatus === "active" && !company.archivedAt)
    return "Con actividad reciente";
  return "";
}

function when(value: string | null) {
  if (!value) return "Sin visitas";
  const date = new Date(value.length === 10 ? `${value}T12:00:00` : value);
  return date.toLocaleDateString("es-MX", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function monthKey() {
  return todayKey().slice(0, 7);
}

export function PlatformConsole() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [requests, setRequests] = useState<AccessRequest[]>([]);
  const [events, setEvents] = useState<LogEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<string | null>(null);
  const [panel, setPanel] = useState<Panel>("datos");
  const [creating, setCreating] = useState(false);
  const [query, setQuery] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    name: "",
    locationName: "Recepción principal",
    locationAddress: "",
    adminName: "",
    adminEmail: "",
  });
  const [created, setCreated] = useState<{
    accessKey: string;
    inviteUrl: string;
    delivery: string;
  } | null>(null);
  const [payment, setPayment] = useState({
    amount: "",
    currency: "MXN",
    paidOn: todayKey(),
    method: "transfer",
    reference: "",
    concept: "",
  });
  const [file, setFile] = useState({
    name: "",
    locations: [] as Array<{ id: string; name: string; address: string }>,
    planName: "",
    monthlyAmount: "",
    currency: "MXN",
    billingEmail: "",
    notes: "",
  });

  async function load() {
    const response = await fetch("/api/platform", { cache: "no-store" });
    if (!response.ok) throw new Error("No fue posible cargar las empresas");
    const payload = (await response.json()) as {
      companies: Company[];
      requests?: AccessRequest[];
      events?: LogEvent[];
    };
    setCompanies(payload.companies ?? []);
    setRequests(payload.requests ?? []);
    setEvents(payload.events ?? []);
  }

  useEffect(() => {
    void load()
      .catch((reason) => toast.error(reason instanceof Error ? reason.message : "Error"))
      .finally(() => setLoading(false));
  }, []);

  function openCompany(company: Company) {
    setOpen(company.id);
    setPanel("datos");
    setFile({
      name: company.name,
      locations: company.locations.map((site) => ({ ...site })),
      planName: company.planName,
      monthlyAmount: company.monthlyAmount == null ? "" : String(company.monthlyAmount),
      currency: company.currency || "MXN",
      billingEmail: company.billingEmail,
      notes: company.notes,
    });
    setPayment({
      amount: "",
      currency: company.currency || "MXN",
      paidOn: todayKey(),
      method: "transfer",
      reference: "",
      concept: "",
    });
  }

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
        delivery?: string;
        error?: string;
      };
      if (!response.ok) throw new Error(payload.error ?? "No fue posible activar");
      setCreated({
        accessKey: payload.accessKey ?? "",
        inviteUrl: payload.inviteUrl ?? "",
        delivery: payload.delivery ?? "development",
      });
      setCreating(false);
      setForm({
        name: "",
        locationName: "Recepción principal",
        locationAddress: "",
        adminName: "",
        adminEmail: "",
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
    const payload = (await response.json()) as {
      error?: string;
      accessKey?: string;
      inviteUrl?: string;
      delivery?: string;
    };
    if (!response.ok) {
      toast.error(payload.error ?? "No fue posible actualizar");
      return null;
    }
    await load();
    return payload;
  }

  async function copy(value: string) {
    await navigator.clipboard.writeText(value);
    toast.success("Copiado");
  }

  const operating = companies.filter((company) => !company.archivedAt);
  const archived = companies.filter((company) => company.archivedAt);
  const listed = showArchived ? archived : operating;
  const visible = listed.filter((company) => {
    const haystack = `${company.name} ${company.billingEmail} ${company.members
      .map((member) => `${member.name} ${member.email}`)
      .join(" ")}`.toLowerCase();
    return haystack.includes(query.trim().toLowerCase());
  });
  const paused = operating.filter((company) => company.serviceStatus !== "active").length;
  const usingToday = operating.filter((company) => company.visitsToday > 0).length;
  const quiet = operating.filter((company) => isQuiet(company)).length;
  const collected = companies
    .flatMap((company) => company.payments)
    .filter((item) => item.paidOn.startsWith(monthKey()))
    .reduce<Record<string, number>>((totals, item) => {
      totals[item.currency] = (totals[item.currency] ?? 0) + item.amount;
      return totals;
    }, {});

  if (loading) return <p className="text-sm text-slate-500">Cargando empresas…</p>;

  const selected = companies.find((company) => company.id === open) ?? null;
  const companyRequests = selected
    ? requests.filter((item) => item.organizationId === selected.id)
    : [];
  const companyEvents = selected
    ? events.filter((item) => item.organizationId === selected.id)
    : [];
  const invitedAdmin = selected
    ? selected.members.some(
        (member) =>
          member.status === "invited" &&
          (member.role === "admin" || member.role === "superadmin"),
      )
    : false;
  const panels: Array<{ id: Panel; label: string }> = selected
    ? [
        { id: "datos", label: "Datos" },
        { id: "gente", label: `Gente · ${selected.members.length}` },
        { id: "visitas", label: `Visitas · ${selected.recentVisits.length}` },
        { id: "pagos", label: `Pagos · ${selected.payments.length}` },
        { id: "solicitudes", label: `Solicitudes · ${companyRequests.length}` },
        { id: "movimientos", label: `Movimientos · ${companyEvents.length}` },
        { id: "ficha", label: "Ficha" },
      ]
    : [];

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-semibold text-[#0d9d99]">Consola NEXA</p>
        <Link href="/app" className="mt-2 inline-block text-sm font-semibold text-blue-600">
          Volver a tu empresa
        </Link>
        <h1 className="mt-1 text-3xl font-semibold tracking-[-.03em]">Empresas</h1>
        <p className="mt-1 text-sm text-slate-500">
          Elige una empresa. Su gente, visitas y pagos se abren aparte.
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-4">
          <p className="text-sm text-slate-500">Empresas</p>
          <p className="mt-1 text-2xl font-semibold">{operating.length}</p>
          <p className="text-sm text-slate-500">
            {paused} en pausa · {archived.length} archivadas
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-slate-500">Actividad</p>
          <p className="mt-1 text-2xl font-semibold">{usingToday} en uso hoy</p>
          <p className="text-sm text-slate-500">{quiet} quietas</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-slate-500">Cobrado este mes</p>
          <p className="mt-1 text-2xl font-semibold">
            {Object.keys(collected).length
              ? Object.entries(collected)
                  .map(([currency, amount]) => money(amount, currency))
                  .join(" · ")
              : "$0"}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-slate-500">Solicitudes en espera</p>
          <p className="mt-1 text-2xl font-semibold">{requests.length}</p>
        </Card>
      </div>

      {created && (
        <Card className="p-5 text-sm">
          <p>
            Clave: <b className="font-mono">{created.accessKey}</b>
          </p>
          <p className="mt-2">
            {created.delivery === "sent"
              ? "El correo de invitación salió."
              : "La invitación quedó lista. Si el correo no salió, comparte este enlace."}
          </p>
          <p className="mt-2 break-all">{created.inviteUrl}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => void copy(created.accessKey)}>
              <Copy size={16} />
              Copiar clave
            </Button>
            <Button variant="outline" onClick={() => void copy(created.inviteUrl)}>
              Copiar invitación
            </Button>
            <Button variant="outline" onClick={() => setCreated(null)}>
              Listo
            </Button>
          </div>
        </Card>
      )}

      {creating && (
        <Card className="p-5">
          <h2 className="font-semibold">Activar empresa</h2>
          <p className="mt-1 text-sm text-slate-500">
            Se crea la empresa, se invita al administrador y aquí queda la clave
            para compartirla con quien vaya a pedir acceso.
          </p>
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
            <div className="flex items-end gap-2">
              <Button type="submit" disabled={busy}>
                {busy ? <Loader2 className="animate-spin" size={16} /> : "Activar e invitar administrador"}
              </Button>
              <Button type="button" variant="outline" onClick={() => setCreating(false)}>
                Cancelar
              </Button>
            </div>
          </form>
        </Card>
      )}

      <div className={`${selected ? "hidden lg:flex" : "flex"} flex-wrap items-center gap-3`}>
        <input
          className={`${fieldClass} min-w-[16rem] flex-1`}
          placeholder="Buscar empresa, persona o correo"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <Button variant="outline" onClick={() => setShowArchived((current) => !current)}>
          {showArchived ? "Ver activas" : `Ver archivadas (${archived.length})`}
        </Button>
        {!creating && (
          <Button variant="outline" onClick={() => setCreating(true)}>
            Activar empresa
          </Button>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-[18rem_minmax(0,1fr)]">
        <div className={selected ? "hidden space-y-2 lg:block" : "space-y-2"}>
          {visible.length === 0 && (
            <p className="text-sm text-slate-500">
              {showArchived ? "No hay empresas archivadas." : "No hay empresas con esa búsqueda."}
            </p>
          )}
          {visible.map((company) => {
            const status = company.archivedAt
              ? "Archivada"
              : company.serviceStatus === "active"
                ? "Activa"
                : "En pausa";
            const note = activityLabel(company);
            return (
              <button
                key={company.id}
                type="button"
                onClick={() => openCompany(company)}
                className={`w-full rounded-2xl border px-4 py-3 text-left ${
                  open === company.id
                    ? "border-[#0d9d99] bg-[#f3fbfb]"
                    : "border-slate-200 bg-white hover:border-slate-300"
                }`}
              >
                <span className="flex items-start justify-between gap-2">
                  <span className="font-semibold">{company.name}</span>
                  {company.pendingRequests > 0 && (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
                      {company.pendingRequests}
                    </span>
                  )}
                </span>
                <span className="mt-1 block text-sm text-slate-500">
                  {status}
                  {note ? ` · ${note}` : ""}
                </span>
                <span className="mt-1 block text-sm text-slate-500">
                  {company.members.length} en el equipo · {company.visits} visitas ·{" "}
                  {company.payments.length} pagos
                </span>
              </button>
            );
          })}
        </div>

        <div className={selected ? "block" : "hidden lg:block"}>
          {!selected ? (
            <Card className="p-5 text-sm text-slate-500">
              Elige una empresa de la lista para ver sus datos.
            </Card>
          ) : (
            <Card className="p-5">
              <button
                type="button"
                className="mb-3 text-sm font-semibold text-blue-600 lg:hidden"
                onClick={() => setOpen(null)}
              >
                Todas las empresas
              </button>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold">{selected.name}</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    {selected.archivedAt
                      ? "Archivada"
                      : selected.serviceStatus === "active"
                        ? "Activa"
                        : "En pausa"}
                    {activityLabel(selected) ? ` · ${activityLabel(selected)}` : ""}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={() => void copy(selected.accessKey)}>
                    <Copy size={16} />
                    Clave
                  </Button>
                  {selected.archivedAt ? (
                    <Button
                      variant="outline"
                      onClick={() => {
                        if (window.confirm(`¿Restaurar ${selected.name}? Vuelve a entrar de inmediato.`))
                          void patch(selected.id, { restore: true });
                      }}
                    >
                      Restaurar
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      onClick={() => {
                        const pausing = selected.serviceStatus === "active";
                        const accepted = window.confirm(
                          pausing
                            ? `Al pausar ${selected.name}, su gente deja de entrar. Los datos se quedan. ¿Pausar?`
                            : `${selected.name} vuelve a entrar de inmediato. ¿Reactivar?`,
                        );
                        if (accepted)
                          void patch(selected.id, {
                            serviceStatus: pausing ? "suspended" : "active",
                          });
                      }}
                    >
                      {selected.serviceStatus === "active" ? "Pausar" : "Reactivar"}
                    </Button>
                  )}
                </div>
              </div>

              <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
                {panels.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setPanel(item.id)}
                    className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-semibold ${
                      panel === item.id
                        ? "bg-slate-900 text-white"
                        : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              {panel === "datos" && (
                <div className="mt-5 space-y-4 text-sm">
                  <p className="font-mono text-[#0d9d99]">{selected.accessKey}</p>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <p>
                      Visitas
                      <b className="mt-1 block text-base">{selected.visits}</b>
                    </p>
                    <p>
                      Este mes
                      <b className="mt-1 block text-base">{selected.visitsThisMonth}</b>
                    </p>
                    <p>
                      Hoy
                      <b className="mt-1 block text-base">{selected.visitsToday}</b>
                    </p>
                  </div>
                  <p className="text-slate-600">
                    Última visita: {when(selected.lastVisitAt)}
                    {selected.invitePending ? " · el administrador no ha abierto la invitación" : ""}
                  </p>
                  <div>
                    <h3 className="font-semibold">Sedes</h3>
                    <ul className="mt-1 space-y-1 text-slate-600">
                      {selected.locations.length === 0 && <li>Sin sede</li>}
                      {selected.locations.map((site) => (
                        <li key={site.id}>
                          {site.name} · {site.address}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h3 className="font-semibold">Áreas</h3>
                    <p className="mt-1 text-slate-600">
                      {selected.departments.length ? selected.departments.join(", ") : "Sin áreas"}
                    </p>
                  </div>
                  <p className="text-slate-500">
                    Pausar cierra la entrada. Las visitas y la gente se quedan. Una clave nueva
                    solo deja de servir para solicitudes nuevas.
                  </p>
                  <Button
                    variant="outline"
                    onClick={() => {
                      const accepted = window.confirm(
                        `La clave de ${selected.name} deja de servir para solicitudes nuevas. Quien ya está dentro sigue dentro. ¿Generar otra?`,
                      );
                      if (!accepted) return;
                      void patch(selected.id, { rotateKey: true }).then((result) => {
                        if (result?.accessKey) {
                          toast.success(`Clave nueva: ${result.accessKey}`);
                          void copy(result.accessKey);
                        }
                      });
                    }}
                  >
                    Nueva clave
                  </Button>
                </div>
              )}

              {panel === "gente" && (
                <div className="mt-5">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-sm font-semibold">Gente</h3>
                    {invitedAdmin && (
                      <Button
                        variant="outline"
                        onClick={() =>
                          void patch(selected.id, { resendAdmin: true }).then((result) => {
                            if (!result) return;
                            toast.success(
                              result.delivery === "sent"
                                ? "Invitación reenviada"
                                : "Enlace listo para compartir",
                            );
                            if (result.inviteUrl) void copy(result.inviteUrl);
                          })
                        }
                      >
                        Reenviar invitación al admin
                      </Button>
                    )}
                  </div>
                  <ul className="mt-2 divide-y divide-slate-100 text-sm">
                    {selected.members.length === 0 && (
                      <li className="py-2 text-slate-500">Sin personas</li>
                    )}
                    {selected.members.map((member) => (
                      <li key={member.id} className="flex justify-between gap-3 py-2">
                        <span>
                          {member.name}
                          {member.department ? ` · ${member.department}` : ""}
                          <span className="block text-slate-500">{member.email}</span>
                        </span>
                        <span className="text-right text-slate-500">
                          {roleLabel[member.role] ?? member.role}
                          <span className="block">
                            {statusLabel[member.status] ?? member.status}
                          </span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {panel === "visitas" && (
                <ul className="mt-5 divide-y divide-slate-100 text-sm">
                  {selected.recentVisits.length === 0 && (
                    <li className="py-2 text-slate-500">Sin visitas</li>
                  )}
                  {selected.recentVisits.map((visit) => (
                    <li key={visit.id} className="flex justify-between gap-3 py-2">
                      <span>
                        {visit.visitor}
                        {visit.host ? ` · con ${visit.host}` : ""}
                        <span className="block text-slate-500">{visit.purpose}</span>
                      </span>
                      <span className="text-right text-slate-500">
                        {stamp(visit.startsAt)}
                        <span className="block">
                          {visitStatusLabel[visit.status] ?? visit.status}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}

              {panel === "pagos" && (
                <div className="mt-5">
                  <h3 className="text-sm font-semibold">Pagos</h3>
                  <p className="mt-1 text-sm text-slate-500">
                    El día en que pagaron y el monto. Queda anotado, no se cobra solo.
                  </p>
                  <ul className="mt-3 divide-y divide-slate-100 text-sm">
                    {selected.payments.length === 0 && (
                      <li className="py-2 text-slate-500">Sin pagos anotados</li>
                    )}
                    {selected.payments.map((item) => (
                      <li key={item.id} className="flex justify-between gap-3 py-2">
                        <span>
                          El {when(item.paidOn)} pagó
                          {item.concept ? ` · ${item.concept}` : ""}
                        </span>
                        <b>{money(item.amount, item.currency)}</b>
                      </li>
                    ))}
                  </ul>
                  <form
                    className="mt-4 grid gap-3 sm:grid-cols-2"
                    onSubmit={(event) => {
                      event.preventDefault();
                      const amount = Number(payment.amount);
                      if (!Number.isFinite(amount) || amount <= 0) {
                        toast.error("Escribe el monto");
                        return;
                      }
                      void patch(selected.id, {
                        payment: {
                          amount,
                          currency: payment.currency,
                          paidOn: payment.paidOn,
                          method: payment.method,
                          reference: payment.reference,
                          concept: payment.concept,
                        },
                      }).then((result) => {
                        if (!result) return;
                        toast.success("Pago registrado");
                        setPayment({ ...payment, amount: "", reference: "", concept: "" });
                      });
                    }}
                  >
                    <Field label="Monto">
                      <input
                        required
                        className={fieldClass}
                        inputMode="decimal"
                        value={payment.amount}
                        onChange={(event) =>
                          setPayment({ ...payment, amount: event.target.value })
                        }
                      />
                    </Field>
                    <Field label="Día en que pagó">
                      <input
                        required
                        type="date"
                        className={fieldClass}
                        value={payment.paidOn}
                        onChange={(event) =>
                          setPayment({ ...payment, paidOn: event.target.value })
                        }
                      />
                    </Field>
                    <Field label="Forma">
                      <select
                        className={fieldClass}
                        value={payment.method}
                        onChange={(event) =>
                          setPayment({ ...payment, method: event.target.value })
                        }
                      >
                        <option value="transfer">Transferencia</option>
                        <option value="cash">Efectivo</option>
                        <option value="card">Tarjeta</option>
                        <option value="other">Otro</option>
                      </select>
                    </Field>
                    <Field label="Moneda">
                      <select
                        className={fieldClass}
                        value={payment.currency}
                        onChange={(event) =>
                          setPayment({ ...payment, currency: event.target.value })
                        }
                      >
                        <option value="MXN">MXN</option>
                        <option value="USD">USD</option>
                      </select>
                    </Field>
                    <Field label="Referencia">
                      <input
                        className={fieldClass}
                        value={payment.reference}
                        onChange={(event) =>
                          setPayment({ ...payment, reference: event.target.value })
                        }
                        placeholder="Folio o últimos dígitos"
                      />
                    </Field>
                    <Field label="Nota">
                      <input
                        className={fieldClass}
                        value={payment.concept}
                        onChange={(event) =>
                          setPayment({ ...payment, concept: event.target.value })
                        }
                        placeholder="Mensualidad de septiembre"
                      />
                    </Field>
                    <div className="sm:col-span-2">
                      <Button type="submit">Anotar pago</Button>
                    </div>
                  </form>
                </div>
              )}

              {panel === "solicitudes" && (
                <div className="mt-5">
                  <h3 className="text-sm font-semibold">Solicitudes</h3>
                  <p className="mt-1 text-sm text-slate-500">
                    Las aprueba el administrador de esta empresa.
                  </p>
                  <ul className="mt-3 divide-y divide-slate-100 text-sm">
                    {companyRequests.length === 0 && (
                      <li className="py-2 text-slate-500">No hay solicitudes en espera.</li>
                    )}
                    {companyRequests.map((item) => (
                      <li key={item.id} className="flex justify-between gap-3 py-2">
                        <span>
                          <b>{item.name}</b> · {item.email}
                          <span className="block text-slate-500">
                            Pide ser {roleLabel[item.role] ?? item.role}
                          </span>
                        </span>
                        <span className="text-slate-500">{stamp(item.createdAt)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {panel === "movimientos" && (
                <ul className="mt-5 divide-y divide-slate-100 text-sm">
                  {companyEvents.length === 0 && (
                    <li className="py-2 text-slate-500">
                      Todavía no hay pausas, claves ni pagos anotados desde aquí.
                    </li>
                  )}
                  {companyEvents.map((item) => (
                    <li key={item.id} className="py-2">
                      {item.summary}
                      <span className="block text-slate-500">
                        {stamp(item.createdAt)} · {item.actorName}
                      </span>
                    </li>
                  ))}
                </ul>
              )}

              {panel === "ficha" && (
                <form
                  className="mt-5 grid gap-3 sm:grid-cols-2"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void patch(selected.id, {
                      name: file.name,
                      locations: file.locations,
                      planName: file.planName,
                      monthlyAmount: file.monthlyAmount ? Number(file.monthlyAmount) : null,
                      currency: file.currency,
                      billingEmail: file.billingEmail,
                      notes: file.notes,
                    }).then((result) => {
                      if (result) toast.success("Ficha guardada");
                    });
                  }}
                >
                  <Field label="Empresa">
                    <input
                      required
                      className={fieldClass}
                      value={file.name}
                      onChange={(event) => setFile({ ...file, name: event.target.value })}
                    />
                  </Field>
                  {file.locations.map((site, index) => (
                    <div key={site.id} className="grid gap-3 sm:col-span-2 sm:grid-cols-2">
                      <Field label="Sede">
                        <input
                          required
                          className={fieldClass}
                          value={site.name}
                          onChange={(event) =>
                            setFile({
                              ...file,
                              locations: file.locations.map((item, itemIndex) =>
                                itemIndex === index ? { ...item, name: event.target.value } : item,
                              ),
                            })
                          }
                        />
                      </Field>
                      <Field label="Dirección">
                        <input
                          required
                          className={fieldClass}
                          value={site.address}
                          onChange={(event) =>
                            setFile({
                              ...file,
                              locations: file.locations.map((item, itemIndex) =>
                                itemIndex === index
                                  ? { ...item, address: event.target.value }
                                  : item,
                              ),
                            })
                          }
                        />
                      </Field>
                    </div>
                  ))}
                  <Field label="Plan">
                    <input
                      className={fieldClass}
                      value={file.planName}
                      onChange={(event) => setFile({ ...file, planName: event.target.value })}
                      placeholder="Mensual, piloto, anual"
                    />
                  </Field>
                  <Field label="Cuota">
                    <input
                      className={fieldClass}
                      inputMode="decimal"
                      value={file.monthlyAmount}
                      onChange={(event) =>
                        setFile({ ...file, monthlyAmount: event.target.value })
                      }
                    />
                  </Field>
                  <Field label="Moneda">
                    <select
                      className={fieldClass}
                      value={file.currency}
                      onChange={(event) => setFile({ ...file, currency: event.target.value })}
                    >
                      <option value="MXN">MXN</option>
                      <option value="USD">USD</option>
                    </select>
                  </Field>
                  <Field label="Correo de cobro">
                    <input
                      type="email"
                      className={fieldClass}
                      value={file.billingEmail}
                      onChange={(event) =>
                        setFile({ ...file, billingEmail: event.target.value })
                      }
                    />
                  </Field>
                  <Field label="Notas internas">
                    <textarea
                      className={fieldClass}
                      rows={3}
                      value={file.notes}
                      onChange={(event) => setFile({ ...file, notes: event.target.value })}
                    />
                  </Field>
                  <div className="flex flex-wrap items-end gap-2">
                    <Button type="submit" variant="outline">
                      Guardar ficha
                    </Button>
                    {!selected.archivedAt && (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          const accepted = window.confirm(
                            `Se archiva ${selected.name}. Dejan de entrar y las visitas se quedan. ¿Archivar?`,
                          );
                          if (accepted) void patch(selected.id, { archive: true });
                        }}
                      >
                        Archivar
                      </Button>
                    )}
                  </div>
                </form>
              )}
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
