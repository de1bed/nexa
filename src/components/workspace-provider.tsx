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
  showcaseLocations,
  showcaseOrganization,
  showcaseSettings,
  showcaseTeam,
} from "@/lib/demo-data";
import {
  getShowcaseServerSnapshot,
  getShowcaseSnapshot,
  loadShowcaseState,
  patchShowcaseVisit,
  subscribeShowcase,
  upsertShowcaseVisit,
} from "@/lib/showcase-store";
import { randomToken } from "@/lib/security";
import type {
  AccessEventType,
  Location,
  MemberRole,
  OrganizationSettings,
  Visit,
  VisitStatus,
  WorkspaceState,
} from "@/lib/domain";

export type HostOption = { id: string; name: string; email: string };

export type Viewer = { id: string; name: string; role: MemberRole };

export type InvitationDraft = {
  visitorName: string;
  email: string;
  phone: string;
  company: string;
  locationId: string;
  hostId?: string;
  startsAt: string;
  endsAt: string;
  purpose: string;
  notes?: string;
  accessRequirements?: string;
  sendEmail: boolean;
  sendWhatsApp: boolean;
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
  hosts: HostOption[];
  settings: OrganizationSettings;
  channels: Channels;
};

type WorkspaceValue = Directory & {
  live: boolean;
  loading: boolean;
  error?: string;
  syncedAt?: string;
  viewer: Viewer;
  visits: Visit[];
  events: WorkspaceState["events"];
  reload: (silent?: boolean) => Promise<void>;
  createInvitation: (
    draft: InvitationDraft,
  ) => Promise<{ visit: Visit; invitationUrl: string }>;
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
  ) => Promise<string>;
};

const WorkspaceContext = createContext<WorkspaceValue | null>(null);

const emptyState: WorkspaceState = { visits: [], events: [] };

const showcaseHosts: HostOption[] = showcaseTeam
  .filter((member) => member.role === "host" || member.role === "admin")
  .map(({ id, name, email }) => ({ id, name, email }));

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
}: {
  children: React.ReactNode;
  viewer: Viewer;
  organization: { id: string; name: string };
}) {
  const live = isLiveMode();

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
    hosts: live ? [] : showcaseHosts,
    settings: showcaseSettings,
    // En vitrina no hay envíos reales: se comparte el enlace a mano.
    channels: { email: false, whatsapp: false },
  });
  const [loading, setLoading] = useState(live);
  const [error, setError] = useState<string>();
  const [syncedAt, setSyncedAt] = useState<string>();

  const state = live ? remoteState : showcaseState;

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
        };
        setRemoteState((current) => ({
          visits: [payload.visit, ...current.visits],
          events: current.events,
        }));
        return payload;
      }

      const location =
        showcaseLocations.find((item) => item.id === draft.locationId) ??
        showcaseLocations[0];
      const host =
        showcaseHosts.find((item) => item.id === (draft.hostId ?? viewer.id)) ??
        showcaseHosts.find((item) => item.id === viewer.id) ??
        showcaseHosts[0];
      const token = randomToken(24);

      const visit: Visit = {
        id: crypto.randomUUID(),
        visitorName: draft.visitorName || "Por confirmar",
        email: draft.email,
        phone: draft.phone || undefined,
        company: draft.company || "",
        hostId: host?.id ?? viewer.id,
        hostName: host?.name ?? viewer.name,
        hostEmail: host?.email,
        locationId: location.id,
        location: location.name,
        locationAddress: location.address,
        startsAt: draft.startsAt,
        endsAt: draft.endsAt,
        purpose: draft.purpose,
        status: "invited",
        origin: "host_invitation",
        notes: draft.notes,
        accessRequirements: draft.accessRequirements,
        documentCaptured: false,
        invitationToken: token,
        inviteeName: draft.visitorName || undefined,
        inviteeEmail: draft.email || undefined,
        inviteePhone: draft.phone || undefined,
        inviteeCompany: draft.company || undefined,
      };

      upsertShowcaseVisit(visit, {
        id: crypto.randomUUID(),
        visitId: visit.id,
        type: "invitation_created",
        at: new Date().toISOString(),
        actor: visit.hostName,
      });

      return {
        visit,
        invitationUrl: `${window.location.origin}/visit/${token}`,
      };
    },
    [live, viewer],
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
        purpose: draft.purpose,
        status: "checked_in",
        origin: "guard_manual",
        documentCaptured: Boolean(draft.documentFile),
        consentedAt: now.toISOString(),
      };

      upsertShowcaseVisit(visit, {
        id: crypto.randomUUID(),
        visitId: visit.id,
        type: "check_in",
        at: now.toISOString(),
        actor: viewer.name,
      });
      return visit;
    },
    [live, viewer],
  );

  const decide = useCallback<WorkspaceValue["decide"]>(
    async (id, status, options) => {
      if (live) {
        const response = await fetch(`/api/visits/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status,
            denialReason: options?.denialReason,
            allowOutsideWindow: options?.allowOutsideWindow ?? false,
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

      patchShowcaseVisit(
        id,
        status === "checked_in"
          ? { status, checkedInAt: now }
          : status === "checked_out"
            ? { status, checkedOutAt: now, qrToken: undefined }
            : {
                status,
                denialReason: options?.denialReason,
                qrToken: undefined,
              },
        { type: eventType, actor: viewer.name, detail: options?.denialReason },
      );
    },
    [live, viewer],
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
        };
        return payload.invitationUrl ?? payload.passUrl ?? "";
      }

      const current = loadShowcaseState().visits.find(
        (visit) => visit.id === id,
      );
      if (!current) return "";

      if (mode === "pass") {
        const passToken = current.qrToken ?? randomToken(24);
        patchShowcaseVisit(id, { qrToken: passToken });
        return `${window.location.origin}/pass/${passToken}`;
      }

      const token = current.invitationToken ?? randomToken(24);
      patchShowcaseVisit(
        id,
        { invitationToken: token },
        { type: "invitation_resent", actor: viewer.name },
      );
      return `${window.location.origin}/visit/${token}`;
    },
    [live, viewer],
  );

  const value = useMemo<WorkspaceValue>(
    () => ({
      live,
      loading,
      error,
      syncedAt,
      viewer,
      ...directory,
      visits: state.visits,
      events: state.events,
      reload,
      createInvitation,
      createManualVisit,
      decide,
      cancelVisit,
      resendLink,
    }),
    [
      live,
      loading,
      error,
      syncedAt,
      viewer,
      directory,
      state,
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
