"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import { isLiveMode } from "@/lib/config";
import {
  showcaseBooths,
  showcaseLocations,
  showcaseOrganization,
  showcaseRequirements,
  showcaseSettings,
  showcaseTeam,
} from "@/lib/demo-data";
import {
  getShowcaseServerSnapshot,
  getShowcaseSnapshot,
  loadShowcaseState,
  patchShowcaseVisit,
  getDemoBoothServerSnapshot,
  getDemoBoothSnapshot,
  subscribeDemoBooths,
  subscribeShowcase,
  upsertShowcaseVisit,
} from "@/lib/showcase-store";
import { DEMO_INVITE_TOKEN, DEMO_PASS_TOKEN } from "@/lib/demo-public";
import { resolveRecordingBooth } from "@/lib/booth-choice";
import type {
  AccessEventType,
  Booth,
  Location,
  MemberRole,
  OrganizationSettings,
  Requirement,
  Visit,
  VisitStatus,
  WorkspaceState,
} from "@/lib/domain";

export type HostOption = {
  id: string;
  name: string;
  email: string;
  department?: string;
};

export type Viewer = { id: string; name: string; role: MemberRole };

export type InvitationDraft = {
  visitorName: string;
  email: string;
  phone: string;
  company: string;
  locationId: string;
  internalPlace?: string;
  meetingUrl?: string;
  hostId?: string;
  startsAt: string;
  endsAt: string;
  passValidDays: number;
  purpose: string;
  notes?: string;
  accessRequirements?: string;
  sendEmail: boolean;
  sendWhatsApp: boolean;
  /** El QR vale en todas las sedes. Si es false, solo en `accessLocationIds`. */
  allLocations: boolean;
  accessLocationIds: string[];
  /** Requisitos del catálogo que se le piden al visitante en esta visita. */
  requirementIds: string[];
};

export type ManualDraft = {
  visitorName: string;
  email: string;
  phone: string;
  company: string;
  hostId: string;
  locationId: string;
  purpose: string;
  documentFile?: File;
};

type Channels = { email: boolean; whatsapp: boolean };

type Directory = {
  organization: { id: string; name: string };
  locations: Location[];
  booths: Booth[];
  hosts: HostOption[];
  /** Catálogo de requisitos activos de la empresa. */
  requirements: Requirement[];
  settings: OrganizationSettings;
  channels: Channels;
  viewer?: {
    defaultLocationId?: string | null;
    defaultBoothId?: string | null;
  };
};

type WorkspaceValue = Omit<Directory, "viewer"> & {
  live: boolean;
  loading: boolean;
  error?: string;
  syncedAt?: string;
  viewer: Viewer;
  visits: Visit[];
  events: WorkspaceState["events"];
  /**
   * Caseta de este dispositivo. El guardia la elige; si no, se usa la que le
   * asignó administración, y si solo hay una caseta activa, esa.
   */
  boothId?: string;
  setBoothId: (boothId: string) => void;
  /**
   * Sede de esa caseta. Sin casetas dadas de alta, es la sede elegida en el
   * dispositivo, igual que antes.
   */
  stationId?: string;
  setStationId: (locationId: string) => void;
  reload: (silent?: boolean) => Promise<void>;
  createInvitation: (
    draft: InvitationDraft,
  ) => Promise<{
    visit: Visit;
    invitationUrl: string;
    emailDelivery: "sent" | "development" | "failed" | "skipped";
  }>;
  createManualVisit: (draft: ManualDraft) => Promise<Visit>;
  decide: (
    id: string,
    status: Extract<VisitStatus, "checked_in" | "checked_out" | "denied">,
    options?: { denialReason?: string; allowOutsideWindow?: boolean },
  ) => Promise<void>;
  cancelVisit: (id: string) => Promise<void>;
  resendLink: (
    id: string,
    mode: "invitation" | "pass",
    notify?: boolean,
  ) => Promise<{
    url: string;
    delivery: "sent" | "development" | "failed" | "skipped";
  }>;
};

const WorkspaceContext = createContext<WorkspaceValue | null>(null);

/* Caseta elegida en este dispositivo, guardada en localStorage. */
const stationListeners = new Set<() => void>();
const memoryStations = new Map<string, string>();

function subscribeStation(listener: () => void) {
  stationListeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    stationListeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

function readStation(key: string): string | null {
  try {
    return window.localStorage.getItem(key) ?? memoryStations.get(key) ?? null;
  } catch {
    return memoryStations.get(key) ?? null;
  }
}

function writeStation(key: string, locationId: string) {
  memoryStations.set(key, locationId);
  try {
    window.localStorage.setItem(key, locationId);
  } catch {
    // Sin almacenamiento la elección dura lo que la pestaña.
  }
  stationListeners.forEach((listener) => listener());
}

const emptyState: WorkspaceState = { visits: [], events: [] };

const showcaseHosts: HostOption[] = showcaseTeam
  .filter((member) => member.role === "host" || member.role === "admin")
  .map(({ id, name, email, department }) => ({ id, name, email, department }));

async function readError(response: Response, fallback: string) {
  try {
    const body = (await response.json()) as { error?: string };
    return body.error ?? fallback;
  } catch {
    return fallback;
  }
}

/** Descarga visitas y catálogo. Vive fuera del componente para no tocar estado. */
async function fetchWorkspace(): Promise<{
  state: WorkspaceState;
  directory?: Directory;
}> {
  const [visitsResponse, directoryResponse] = await Promise.all([
    fetch("/api/visits", { cache: "no-store" }),
    fetch("/api/directory", { cache: "no-store" }),
  ]);

  if (!visitsResponse.ok)
    throw new Error(
      await readError(visitsResponse, "No fue posible cargar las visitas"),
    );

  const payload = (await visitsResponse.json()) as Partial<WorkspaceState>;
  const state: WorkspaceState = {
    visits: payload.visits ?? [],
    events: payload.events ?? [],
  };

  if (!directoryResponse.ok) return { state };
  const directory = (await directoryResponse.json()) as Directory;
  return { state, directory };
}

export function WorkspaceProvider({
  children,
  viewer,
  organization: initialOrganization,
  sandbox = false,
}: {
  children: React.ReactNode;
  viewer: Viewer;
  organization: { id: string; name: string };
  /** Recorrido de demostración: datos de ejemplo, sin escribir en la base. */
  sandbox?: boolean;
}) {
  const live = isLiveMode() && !sandbox;

  // En vitrina el estado vive en el store local y se comparte entre pestañas.
  const showcaseState = useSyncExternalStore(
    subscribeShowcase,
    getShowcaseSnapshot,
    getShowcaseServerSnapshot,
  );

  const [remoteState, setRemoteState] = useState<WorkspaceState>(emptyState);
  const [directory, setDirectory] = useState<Directory>({
    organization: live ? initialOrganization : showcaseOrganization,
    locations: live ? [] : showcaseLocations,
    booths: live ? [] : showcaseBooths,
    hosts: live ? [] : showcaseHosts,
    requirements: live ? [] : showcaseRequirements,
    settings: showcaseSettings,
    // En vitrina no hay envíos reales: se comparte el enlace a mano.
    channels: { email: false, whatsapp: false },
  });
  const [loading, setLoading] = useState(live);
  const [error, setError] = useState<string>();
  const [syncedAt, setSyncedAt] = useState<string>();

  const state = live ? remoteState : showcaseState;
  const demoBooths = useSyncExternalStore(
    subscribeDemoBooths,
    getDemoBoothSnapshot,
    getDemoBoothServerSnapshot,
  );
  const booths = useMemo(() => {
    if (live) return directory.booths;
    const byId = new Map<string, Booth>();
    for (const booth of showcaseBooths) byId.set(booth.id, booth);
    for (const booth of demoBooths) byId.set(booth.id, booth);
    return [...byId.values()];
  }, [live, directory.booths, demoBooths]);

  // Caseta del dispositivo: se recuerda por empresa en este navegador.
  const boothKey = `nexa-guard-booth:${directory.organization.id}`;
  const stationKey = `nexa-guard-station:${directory.organization.id}`;
  const boothChoice = useSyncExternalStore(
    subscribeStation,
    () => readStation(boothKey),
    () => null,
  );
  const stationChoice = useSyncExternalStore(
    subscribeStation,
    () => readStation(stationKey),
    () => null,
  );
  const setBoothId = useCallback(
    (nextBoothId: string) => writeStation(boothKey, nextBoothId),
    [boothKey],
  );
  const setStationId = useCallback(
    (locationId: string) => writeStation(stationKey, locationId),
    [stationKey],
  );
  const activeBooths = useMemo(
    () => booths.filter((booth) => booth.active),
    [booths],
  );
  const boothId = useMemo(() => {
    if (activeBooths.length === 0) return undefined;
    const known = (id?: string | null) =>
      id && activeBooths.some((booth) => booth.id === id) ? id : undefined;
    const siteBooths = activeBooths.filter(
      (booth) => booth.locationId === directory.viewer?.defaultLocationId,
    );
    const fromSite = siteBooths.length === 1 ? siteBooths[0].id : undefined;
    return (
      known(boothChoice) ??
      known(directory.viewer?.defaultBoothId) ??
      fromSite ??
      (activeBooths.length === 1 ? activeBooths[0].id : undefined)
    );
  }, [activeBooths, boothChoice, directory.viewer]);
  const stationId = useMemo(() => {
    if (boothId) return booths.find((booth) => booth.id === boothId)?.locationId;
    const known = (id?: string | null) =>
      id && directory.locations.some((item) => item.id === id) ? id : undefined;
    return (
      known(stationChoice) ??
      known(directory.viewer?.defaultLocationId) ??
      (directory.locations.length === 1 ? directory.locations[0].id : undefined)
    );
  }, [boothId, booths, directory.locations, directory.viewer, stationChoice]);

  const reload = useCallback(async (silent = false) => {
    if (!live) return;
    if (!silent) setError(undefined);
    try {
      const result = await fetchWorkspace();
      setRemoteState(result.state);
      if (result.directory) setDirectory(result.directory);
      setSyncedAt(new Date().toISOString());
      setError(undefined);
    } catch (reason) {
      if (silent) return;
      setError(
        reason instanceof Error
          ? reason.message
          : "No fue posible sincronizar la información",
      );
    }
  }, [live]);

  // Carga inicial. El estado solo se toca después del `await`.
  useEffect(() => {
    if (!live) return;
    let active = true;

    void (async () => {
      try {
        const result = await fetchWorkspace();
        if (!active) return;
        setRemoteState(result.state);
        if (result.directory) setDirectory(result.directory);
        setSyncedAt(new Date().toISOString());
      } catch (reason) {
        if (!active) return;
        setError(
          reason instanceof Error
            ? reason.message
            : "No fue posible sincronizar la información",
        );
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [live]);

  useEffect(() => {
    if (!live) return;

    const tick = () => {
      if (document.visibilityState === "hidden") return;
      void reload(true);
    };

    const id = window.setInterval(tick, 20000);
    document.addEventListener("visibilitychange", tick);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [live, reload]);

  const createInvitation = useCallback<WorkspaceValue["createInvitation"]>(
    async (draft) => {
      if (live) {
        const response = await fetch("/api/visits", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(draft),
        });
        if (!response.ok)
          throw new Error(
            await readError(response, "No fue posible crear la invitación"),
          );
        const payload = (await response.json()) as {
          visit: Visit;
          invitationUrl: string;
          emailDelivery?: "sent" | "development" | "failed" | "skipped";
        };
        setRemoteState((current) => ({
          visits: [payload.visit, ...current.visits],
          events: current.events,
        }));
        return {
          visit: payload.visit,
          invitationUrl: payload.invitationUrl,
          emailDelivery: payload.emailDelivery ?? "skipped",
        };
      }

      const visit = loadShowcaseState().visits.find(
        (item) => item.invitationToken === DEMO_INVITE_TOKEN,
      );
      if (!visit) throw new Error("No fue posible abrir la invitación de demostración");

      return {
        visit,
        invitationUrl: `${window.location.origin}/visit/${DEMO_INVITE_TOKEN}`,
        emailDelivery: "skipped",
      };
    },
    [live],
  );

  const createManualVisit = useCallback<WorkspaceValue["createManualVisit"]>(
    async (draft) => {
      if (live) {
        const form = new FormData();
        form.set("visitorName", draft.visitorName);
        form.set("email", draft.email);
        form.set("phone", draft.phone);
        form.set("company", draft.company);
        form.set("hostId", draft.hostId);
        form.set("locationId", draft.locationId);
        form.set("purpose", draft.purpose);
        form.set("consent", "true");
        const requested = booths.find(
          (item) => item.id === boothId && item.locationId === draft.locationId,
        );
        const booth = resolveRecordingBooth({
          booths,
          boothId: requested?.id,
          locationId: draft.locationId,
          decision: "check_in",
        });
        if (booth) form.set("boothId", booth.id);
        if (draft.documentFile) form.set("document", draft.documentFile);

        const response = await fetch("/api/visits/manual", {
          method: "POST",
          body: form,
        });
        if (!response.ok)
          throw new Error(
            await readError(response, "No fue posible registrar el acceso"),
          );
        const payload = (await response.json()) as { visit: Visit };
        setRemoteState((current) => ({
          visits: [payload.visit, ...current.visits],
          events: current.events,
        }));
        return payload.visit;
      }

      const now = new Date();
      const location =
        showcaseLocations.find((item) => item.id === draft.locationId) ??
        showcaseLocations[0];
      const host =
        showcaseHosts.find((item) => item.id === draft.hostId) ?? showcaseHosts[0];
      const requested = booths.find(
        (item) => item.id === boothId && item.locationId === location.id,
      );
      const booth = resolveRecordingBooth({
        booths,
        boothId: requested?.id,
        locationId: location.id,
        decision: "check_in",
      });

      const visit: Visit = {
        id: crypto.randomUUID(),
        visitorName: draft.visitorName,
        email: draft.email,
        phone: draft.phone || undefined,
        company: draft.company,
        hostId: host?.id ?? "",
        hostName: host?.name ?? "Anfitrión",
        locationId: location.id,
        location: location.name,
        locationAddress: location.address,
        startsAt: now.toISOString(),
        endsAt: new Date(now.getTime() + 3600000).toISOString(),
        checkedInAt: now.toISOString(),
        checkInBoothId: booth?.id,
        checkInBooth: booth?.name,
        checkInSite: location.name,
        checkInBy: viewer.name,
        purpose: draft.purpose,
        status: "checked_in",
        origin: "guard_manual",
        documentCaptured: Boolean(draft.documentFile),
        identityCaptured: Boolean(draft.documentFile),
        vehiclePhotosCaptured: false,
        attachmentsCaptured: false,
        consentedAt: now.toISOString(),
      };

      upsertShowcaseVisit(visit, {
        id: crypto.randomUUID(),
        visitId: visit.id,
        type: "check_in",
        at: now.toISOString(),
        actor: viewer.name,
        booth: booth?.name,
      });
      return visit;
    },
    [live, viewer, boothId, booths],
  );

  const decide = useCallback<WorkspaceValue["decide"]>(
    async (id, status, options) => {
      const decision =
        status === "checked_in"
          ? "check_in"
          : status === "checked_out"
            ? "check_out"
            : "deny";
      const booth = resolveRecordingBooth({
        booths,
        boothId,
        locationId: stationId,
        decision,
      });

      if (live) {
        const response = await fetch(`/api/visits/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status,
            denialReason: options?.denialReason,
            allowOutsideWindow: options?.allowOutsideWindow ?? false,
            locationId: booth?.locationId ?? stationId,
            boothId: booth?.id,
          }),
        });
        if (!response.ok)
          throw new Error(
            await readError(response, "No fue posible registrar la decisión"),
          );
        const payload = (await response.json()) as { visit: Visit | null };
        const updated = payload.visit;
        if (updated)
          setRemoteState((current) => ({
            visits: current.visits.some((visit) => visit.id === id)
              ? current.visits.map((visit) =>
                  visit.id === id ? updated : visit,
                )
              : [updated, ...current.visits],
            events: current.events,
          }));
        return;
      }

      const now = new Date().toISOString();
      const eventType: AccessEventType =
        status === "checked_in"
          ? "check_in"
          : status === "checked_out"
            ? "check_out"
            : "denied";

      const site = directory.locations.find(
        (item) => item.id === (booth?.locationId ?? stationId),
      );
      patchShowcaseVisit(
        id,
        status === "checked_in"
          ? {
              status,
              checkedInAt: now,
              checkInBoothId: booth?.id,
              checkInBooth: booth?.name,
              checkInSite: site?.name,
              checkInBy: viewer.name,
            }
          : status === "checked_out"
            ? {
                status,
                checkedOutAt: now,
                qrToken: undefined,
                ...(booth
                  ? {
                      checkOutBoothId: booth.id,
                      checkOutBooth: booth.name,
                      checkOutSite: site?.name,
                    }
                  : {}),
                checkOutBy: viewer.name,
              }
            : {
                status,
                denialReason: options?.denialReason,
                qrToken: undefined,
                deniedBy: viewer.name,
                denialBoothId: booth?.id,
                denialBooth: booth?.name,
              },
        {
          type: eventType,
          actor: viewer.name,
          detail: options?.denialReason,
          booth: booth?.name,
        },
      );
    },
    [live, viewer, stationId, boothId, booths, directory.locations],
  );

  const cancelVisit = useCallback<WorkspaceValue["cancelVisit"]>(
    async (id) => {
      if (live) {
        const response = await fetch(`/api/visits/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "cancelled" }),
        });
        if (!response.ok)
          throw new Error(
            await readError(response, "No fue posible cancelar la visita"),
          );
        setRemoteState((current) => ({
          visits: current.visits.map((visit) =>
            visit.id === id
              ? { ...visit, status: "cancelled", qrToken: undefined }
              : visit,
          ),
          events: current.events,
        }));
        return;
      }

      patchShowcaseVisit(
        id,
        { status: "cancelled", qrToken: undefined, invitationToken: undefined },
        { type: "cancelled", actor: viewer.name },
      );
    },
    [live, viewer],
  );

  const resendLink = useCallback<WorkspaceValue["resendLink"]>(
    async (id, mode, notify = true) => {
      if (live) {
        const response = await fetch(`/api/visits/${id}/resend`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode, notify }),
        });
        if (!response.ok)
          throw new Error(
            await readError(response, "No fue posible generar el enlace"),
          );
        const payload = (await response.json()) as {
          invitationUrl?: string;
          passUrl?: string;
          delivery?: "sent" | "development" | "failed" | "skipped";
        };
        return {
          url: payload.invitationUrl ?? payload.passUrl ?? "",
          delivery: payload.delivery ?? "skipped",
        };
      }

      if (mode === "pass") {
        return {
          url: `${window.location.origin}/pass/${DEMO_PASS_TOKEN}`,
          delivery: "skipped",
        };
      }

      return {
        url: `${window.location.origin}/visit/${DEMO_INVITE_TOKEN}`,
        delivery: "skipped",
      };
    },
    [live],
  );

  const value = useMemo<WorkspaceValue>(() => {
    // El directorio remoto también trae `viewer`; manda el de la sesión.
    const { viewer: _remoteViewer, booths: _catalogBooths, ...catalog } = directory;
    void _remoteViewer;
    void _catalogBooths;
    return {
      live,
      loading,
      error,
      syncedAt,
      viewer,
      ...catalog,
      booths,
      visits: state.visits,
      events: state.events,
      stationId,
      setStationId,
      boothId,
      setBoothId,
      reload,
      createInvitation,
      createManualVisit,
      decide,
      cancelVisit,
      resendLink,
    };
  },
    [
      live,
      loading,
      error,
      syncedAt,
      viewer,
      directory,
      booths,
      state,
      stationId,
      setStationId,
      boothId,
      setBoothId,
      reload,
      createInvitation,
      createManualVisit,
      decide,
      cancelVisit,
      resendLink,
    ],
  );

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (!context)
    throw new Error("useWorkspace debe usarse dentro de WorkspaceProvider");
  return context;
}

/** Visitas del anfitrión activo. En modo real la API ya viene acotada por RLS. */
export function useMyVisits() {
  const { visits, viewer } = useWorkspace();
  return useMemo(
    () =>
      viewer.role === "host"
        ? visits.filter((visit) => visit.hostId === viewer.id)
        : visits,
    [visits, viewer],
  );
}
