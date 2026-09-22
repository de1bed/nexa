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
  organizationName: string;
  name: string;
  email: string;
  role: string;
  createdAt: string;
};

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

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-semibold text-[#0d9d99]">Consola NEXA</p>
        <Link href="/app" className="mt-2 inline-block text-sm font-semibold text-blue-600">
          Volver a tu empresa
        </Link>
        <h1 className="mt-1 text-3xl font-semibold tracking-[-.03em]">Empresas</h1>
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

      <Card className="p-5">
        <h2 className="font-semibold">Solicitudes de todas las empresas</h2>
        <p className="mt-1 text-sm text-slate-500">
          Las aprueba el administrador de cada empresa. Aquí ves si se están quedando.
        </p>
        {requests.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">No hay solicitudes en espera.</p>
        ) : (
          <ul className="mt-3 divide-y divide-slate-100 text-sm">
            {requests.map((item) => (
              <li key={item.id} className="flex flex-wrap justify-between gap-2 py-2">
                <span>
                  <b>{item.name}</b> · {item.email}
                  <span className="block text-slate-500">
                    {item.organizationName} · pide ser {roleLabel[item.role] ?? item.role}
                  </span>
                </span>
                <span className="text-slate-500">{stamp(item.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="p-5">
        <h2 className="font-semibold">Bitácora</h2>
        <p className="mt-1 text-sm text-slate-500">
          Los datos de cada empresa: gente, sedes, visitas y el día en que pagó.
        </p>
        <div className="mt-4 space-y-4">
          {companies.map((company) => {
            const companyEvents = events.filter(
              (item) => item.organizationId === company.id,
            );
            return (
              <article key={company.id} className="rounded-2xl border border-slate-200 p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h3 className="font-semibold">{company.name}</h3>
                    <p className="text-sm text-slate-500">
                      {company.archivedAt
                        ? "Archivada"
                        : company.serviceStatus === "active"
                          ? "Activa"
                          : "En pausa"}
                      {activityLabel(company) ? ` · ${activityLabel(company)}` : ""} ·{" "}
                      {company.visits} visitas · última {when(company.lastVisitAt)}
                    </p>
                  </div>
                  <p className="font-mono text-sm text-[#0d9d99]">{company.accessKey}</p>
                </div>
                <p className="mt-3 text-sm text-slate-600">
                  {company.locations.length
                    ? company.locations
                        .map((site) => `${site.name} · ${site.address}`)
                        .join(" / ")
                    : "Sin sede"}
                  {company.departments.length
                    ? ` · Áreas: ${company.departments.join(", ")}`
                    : ""}
                </p>
                <div className="mt-3 grid gap-4 lg:grid-cols-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                      Gente
                    </p>
                    <ul className="mt-1 space-y-1 text-sm">
                      {company.members.length === 0 && (
                        <li className="text-slate-500">Sin personas</li>
                      )}
                      {company.members.map((member) => (
                        <li key={member.id}>
                          {member.name}
                          {member.department ? ` · ${member.department}` : ""}
                          <span className="block text-slate-500">
                            {member.email} · {roleLabel[member.role] ?? member.role} ·{" "}
                            {statusLabel[member.status] ?? member.status}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                      Visitas
                    </p>
                    <ul className="mt-1 space-y-1 text-sm">
                      {company.recentVisits.length === 0 && (
                        <li className="text-slate-500">Sin visitas</li>
                      )}
                      {company.recentVisits.map((visit) => (
                        <li key={visit.id}>
                          {visit.visitor}
                          {visit.host ? ` · con ${visit.host}` : ""}
                          <span className="block text-slate-500">
                            {stamp(visit.startsAt)} · {visit.purpose} ·{" "}
                            {visitStatusLabel[visit.status] ?? visit.status}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                      Pagos y movimientos
                    </p>
                    <ul className="mt-1 space-y-1 text-sm">
                      {company.payments.length === 0 && companyEvents.length === 0 && (
                        <li className="text-slate-500">Sin pagos anotados</li>
                      )}
                      {company.payments.map((item) => (
                        <li key={item.id}>
                          El {when(item.paidOn)} pagó {money(item.amount, item.currency)}
                          {item.concept ? ` · ${item.concept}` : ""}
                        </li>
                      ))}
                      {companyEvents.map((item) => (
                        <li key={item.id} className="text-slate-500">
                          {stamp(item.createdAt)} · {item.actorName}: {item.summary}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </Card>

      <Card className="p-5">
        <h2 className="font-semibold">Registro de pagos</h2>
        <p className="mt-1 text-sm text-slate-500">
          Solo un apunte: qué empresa pagó y qué día. No cobra solo.
        </p>
        {companies.every((company) => company.payments.length === 0) ? (
          <p className="mt-3 text-sm text-slate-500">
            Cuando anotes un pago en una empresa, aparece aquí con la fecha.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-slate-100 text-sm">
            {companies
              .flatMap((company) =>
                company.payments.map((item) => ({ ...item, company: company.name })),
              )
              .sort((a, b) => b.paidOn.localeCompare(a.paidOn))
              .map((item) => (
                <li key={item.id} className="flex justify-between gap-3 py-2">
                  <span>
                    El {when(item.paidOn)} {item.company} pagó
                    {item.concept ? ` · ${item.concept}` : ""}
                  </span>
                  <b>{money(item.amount, item.currency)}</b>
                </li>
              ))}
          </ul>
        )}
      </Card>

      <Card className="p-5 text-sm leading-6 text-slate-600">
        <p>
          Tú invitas al primer administrador por correo. Esa persona elige su
          contraseña y entra sin clave. Desde Equipo invita al resto, o la gente
          crea su cuenta con la clave y espera a que ese administrador la acepte.
        </p>
        <p className="mt-2">
          <b>Pausar</b> cierra la entrada de esa empresa. Las visitas, el equipo
          y los pagos se quedan. Al reactivar, las mismas cuentas vuelven a entrar.
        </p>
        <p className="mt-2">
          <b>Nueva clave</b> invalida la anterior para solicitudes nuevas. Quien
          ya está dentro sigue dentro, y las solicitudes ya enviadas siguen en la
          fila del administrador.
        </p>
      </Card>

      <Card className="p-5">
        <h2 className="font-semibold">Activar empresa</h2>
        <p className="mt-1 text-sm text-slate-500">
          Se crea la empresa, se invita al administrador y aquí queda la clave
          para compartirla con quien vaya a pedir acceso.
        </p>
        {created ? (
          <div className="mt-4 space-y-3 text-sm">
            <p>
              Clave: <b className="font-mono">{created.accessKey}</b>
            </p>
            <p>
              {created.delivery === "sent"
                ? "El correo de invitación salió."
                : "La invitación quedó lista. Si el correo no salió, comparte este enlace."}
            </p>
            <p className="break-all">{created.inviteUrl}</p>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => void copy(created.accessKey)}>
                <Copy size={16} />
                Copiar clave
              </Button>
              <Button variant="outline" onClick={() => void copy(created.inviteUrl)}>
                Copiar invitación
              </Button>
              <Button variant="outline" onClick={() => setCreated(null)}>
                Activar otra
              </Button>
            </div>
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
                {busy ? <Loader2 className="animate-spin" size={16} /> : "Activar e invitar administrador"}
              </Button>
            </div>
          </form>
        )}
      </Card>

      <div className="flex flex-wrap items-center gap-3">
        <input
          className={`${fieldClass} min-w-[16rem] flex-1`}
          placeholder="Buscar empresa, persona o correo"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <Button variant="outline" onClick={() => setShowArchived((current) => !current)}>
          {showArchived ? "Ver activas" : `Ver archivadas (${archived.length})`}
        </Button>
      </div>

      <div className="space-y-3">
        {visible.map((company) => {
          const activePeople = company.members.filter((member) => member.status === "active").length;
          const invitedAdmin = company.members.some(
            (member) =>
              member.status === "invited" &&
              (member.role === "admin" || member.role === "superadmin"),
          );
          const paid = company.payments.reduce<Record<string, number>>((totals, item) => {
            totals[item.currency] = (totals[item.currency] ?? 0) + item.amount;
            return totals;
          }, {});
          return (
            <Card key={company.id} className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold">{company.name}</h2>
                  <p className="mt-1 font-mono text-sm text-[#0d9d99]">{company.accessKey}</p>
                  <p className="mt-1 text-sm text-slate-500">
                    {company.archivedAt
                      ? "Archivada"
                      : company.serviceStatus === "active"
                        ? "Activa"
                        : "En pausa"}{" "}
                    {activityLabel(company) ? ` · ${activityLabel(company)}` : ""} · {activePeople} dentro ·{" "}
                    {company.members.length} en el equipo · {company.visits} visitas
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    Hoy {company.visitsToday}{" "}
                    {company.visitsToday === 1 ? "visita" : "visitas"} · última{" "}
                    {when(company.lastVisitAt)}
                    {company.invitePending ? " · el administrador no ha abierto la invitación" : ""}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    {company.planName || "Sin plan"}
                    {company.monthlyAmount != null
                      ? ` · ${money(company.monthlyAmount, company.currency)} / mes`
                      : ""}
                    {Object.keys(paid).length
                      ? ` · cobrado ${Object.entries(paid)
                          .map(([currency, amount]) => money(amount, currency))
                          .join(" · ")}`
                      : " · sin pagos registrados"}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={() => void copy(company.accessKey)}>
                    <Copy size={16} />
                    Clave
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() =>
                      open === company.id ? setOpen(null) : openCompany(company)
                    }
                  >
                    {open === company.id ? "Ocultar" : "Ver y cobrar"}
                  </Button>
                  {company.archivedAt ? (
                    <Button
                      variant="outline"
                      onClick={() => {
                        if (window.confirm(`¿Restaurar ${company.name}? Vuelve a entrar de inmediato.`))
                          void patch(company.id, { restore: true });
                      }}
                    >
                      Restaurar
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      onClick={() => {
                        const pausing = company.serviceStatus === "active";
                        const accepted = window.confirm(
                          pausing
                            ? `Al pausar ${company.name}, su gente deja de entrar. Los datos se quedan. ¿Pausar?`
                            : `${company.name} vuelve a entrar de inmediato. ¿Reactivar?`,
                        );
                        if (accepted)
                          void patch(company.id, {
                            serviceStatus: pausing ? "suspended" : "active",
                          });
                      }}
                    >
                      {company.serviceStatus === "active" ? "Pausar" : "Reactivar"}
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    onClick={() => {
                      const accepted = window.confirm(
                        `La clave de ${company.name} deja de servir para solicitudes nuevas. Quien ya está dentro sigue dentro. ¿Generar otra?`,
                      );
                      if (!accepted) return;
                      void patch(company.id, { rotateKey: true }).then((result) => {
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
              </div>

              {open === company.id && (
                <div className="mt-5 space-y-5 border-t border-slate-100 pt-5">
                  <div className="grid gap-3 text-sm sm:grid-cols-3">
                    <p>
                      Visitas este mes
                      <b className="mt-1 block text-base">{company.visitsThisMonth}</b>
                    </p>
                    <p>
                      Última visita
                      <b className="mt-1 block text-base">{when(company.lastVisitAt)}</b>
                    </p>
                    <p>
                      Solicitudes
                      <b className="mt-1 block text-base">{company.pendingRequests}</b>
                    </p>
                  </div>

                  <div>
                    <h3 className="text-sm font-semibold">Sedes y áreas</h3>
                    <p className="mt-1 text-sm text-slate-500">
                      {company.locations.length
                        ? company.locations
                            .map((site) => `${site.name} · ${site.address}`)
                            .join(" / ")
                        : "Sin sede"}
                      {company.departments.length
                        ? ` · Áreas: ${company.departments.join(", ")}`
                        : ""}
                    </p>
                  </div>

                  <div>
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="text-sm font-semibold">Gente</h3>
                      {invitedAdmin && (
                        <Button
                          variant="outline"
                          onClick={() =>
                            void patch(company.id, { resendAdmin: true }).then((result) => {
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
                      {company.members.map((member) => (
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

                  <form
                    className="grid gap-3 sm:grid-cols-2"
                    onSubmit={(event) => {
                      event.preventDefault();
                      void patch(company.id, {
                        name: file.name,
                        locations: file.locations,
                        planName: file.planName,
                        monthlyAmount: file.monthlyAmount
                          ? Number(file.monthlyAmount)
                          : null,
                        currency: file.currency,
                        billingEmail: file.billingEmail,
                        notes: file.notes,
                      }).then((result) => {
                        if (result) toast.success("Ficha guardada");
                      });
                    }}
                  >
                    <h3 className="sm:col-span-2 text-sm font-semibold">Ficha</h3>
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
                                  itemIndex === index
                                    ? { ...item, name: event.target.value }
                                    : item,
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
                        onChange={(event) =>
                          setFile({ ...file, planName: event.target.value })
                        }
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
                        onChange={(event) =>
                          setFile({ ...file, currency: event.target.value })
                        }
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
                        onChange={(event) =>
                          setFile({ ...file, notes: event.target.value })
                        }
                      />
                    </Field>
                    <div className="flex flex-wrap items-end gap-2">
                      <Button type="submit" variant="outline">
                        Guardar ficha
                      </Button>
                      {!company.archivedAt && (
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            const accepted = window.confirm(
                              `Se archiva ${company.name}. Dejan de entrar y las visitas se quedan. ¿Archivar?`,
                            );
                            if (accepted) void patch(company.id, { archive: true });
                          }}
                        >
                          Archivar
                        </Button>
                      )}
                    </div>
                  </form>

                  <div>
                    <h3 className="text-sm font-semibold">Anotar un pago</h3>
                    <p className="mt-1 text-sm text-slate-500">
                      El día en que pagaron y el monto. Queda en el registro.
                    </p>
                    <ul className="mt-2 space-y-2 text-sm">
                      {company.payments.map((item) => (
                        <li key={item.id}>
                          El {when(item.paidOn)} pagó {money(item.amount, item.currency)}
                          {item.concept ? ` · ${item.concept}` : ""}
                        </li>
                      ))}
                    </ul>
                    <form
                      className="mt-3 grid gap-3 sm:grid-cols-2"
                      onSubmit={(event) => {
                        event.preventDefault();
                        const amount = Number(payment.amount);
                        if (!Number.isFinite(amount) || amount <= 0) {
                          toast.error("Escribe el monto");
                          return;
                        }
                        void patch(company.id, {
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
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
