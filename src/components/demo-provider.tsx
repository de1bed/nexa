"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { initialDemoState } from "@/lib/demo-data";
import type { DemoState, Visit } from "@/lib/domain";
import { hasSupabaseConfig } from "@/lib/supabase/client";

type EventInput = {
  type: DemoState["events"][number]["type"];
  actor: string;
  detail?: string;
};
export type CreateVisitInput = Visit & {
  sendEmail?: boolean;
  accessRequirements?: string;
  documentFile?: File;
};
type Ctx = {
  state: DemoState;
  loading: boolean;
  error?: string;
  production: boolean;
  createVisit: (visit: CreateVisitInput) => Promise<Visit>;
  updateVisit: (
    id: string,
    patch: Partial<Visit>,
    event?: EventInput,
    options?: { allowOutsideWindow?: boolean },
  ) => Promise<void>;
  reload: () => Promise<void>;
  reset: () => void;
};

const DataContext = createContext<Ctx | null>(null);
const storageKey = "nexa-visit-demo-v2";

export function DemoProvider({ children }: { children: React.ReactNode }) {
  const production =
    process.env.NEXT_PUBLIC_DEMO_MODE === "false" && hasSupabaseConfig();
  const [state, setState] = useState<DemoState>(
    production ? { visits: [], events: [] } : initialDemoState,
  );
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(production);
  const [error, setError] = useState<string>();

  async function reload() {
    if (!production) return;
    setLoading(true);
    setError(undefined);
    try {
      const response = await fetch("/api/visits", { cache: "no-store" });
      if (response.status === 401) return;
      if (!response.ok)
        throw new Error("No fue posible sincronizar las visitas");
      setState((await response.json()) as DemoState);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Error de sincronización",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (production) {
      // La carga asíncrona inicial sincroniza el store React con la fuente remota.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      void reload();
      setReady(true);
      return;
    }
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) setState(JSON.parse(saved) as DemoState);
    } finally {
      setReady(true);
    }
    // La selección del adaptador queda fijada por variables de build.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [production]);

  useEffect(() => {
    if (ready && !production)
      localStorage.setItem(storageKey, JSON.stringify(state));
  }, [state, ready, production]);

  async function createVisit(input: CreateVisitInput) {
    if (!production) {
      setState((current) => ({
        visits: [input, ...current.visits],
        events: [
          {
            id: crypto.randomUUID(),
            visitId: input.id,
            type: "invitation_created",
            at: new Date().toISOString(),
            actor: input.hostName,
          },
          ...current.events,
        ],
      }));
      return input;
    }
    const endpoint =
      input.origin === "guard_manual" ? "/api/visits/manual" : "/api/visits";
    const payload = {
        visitorName: input.visitorName,
        email: input.email,
        phone: input.phone,
        company: input.company,
        hostName: input.hostName,
        location: input.location,
        startsAt: input.startsAt,
        endsAt: input.endsAt,
        purpose: input.purpose,
        notes: input.notes,
        accessRequirements: input.accessRequirements,
        sendEmail: input.sendEmail ?? false,
        consent: Boolean(input.consentedAt),
        documentCaptured: input.documentCaptured,
      };
    let body: BodyInit;
    let headers: HeadersInit | undefined;
    if (input.origin === "guard_manual") {
      const form = new FormData();
      Object.entries(payload).forEach(([key, value]) =>
        form.set(key, String(value ?? "")),
      );
      if (input.documentFile) form.set("document", input.documentFile);
      body = form;
    } else {
      headers = { "Content-Type": "application/json" };
      body = JSON.stringify(payload);
    }
    const response = await fetch(endpoint, { method: "POST", headers, body });
    const result = (await response.json()) as {
      visit?: Visit;
      invitationToken?: string;
      error?: string;
    };
    if (!response.ok || !result.visit)
      throw new Error(result.error ?? "No fue posible crear la visita");
    const created = {
      ...result.visit,
      invitationToken: result.invitationToken,
    };
    setState((current) => ({
      visits: [created, ...current.visits],
      events: current.events,
    }));
    return created;
  }

  async function updateVisit(
    id: string,
    patch: Partial<Visit>,
    event?: EventInput,
    options?: { allowOutsideWindow?: boolean },
  ) {
    const previous = state.visits.find((visit) => visit.id === id);
    setState((current) => ({
      visits: current.visits.map((visit) =>
        visit.id === id ? { ...visit, ...patch } : visit,
      ),
      events: event
        ? [
            {
              id: crypto.randomUUID(),
              visitId: id,
              type: event.type,
              at: new Date().toISOString(),
              actor: event.actor,
              detail: event.detail,
            },
            ...current.events,
          ]
        : current.events,
    }));
    if (!production || !patch.status) return;
    const response = await fetch(`/api/visits/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: patch.status,
        denialReason: patch.denialReason,
        allowOutsideWindow: options?.allowOutsideWindow ?? false,
      }),
    });
    if (!response.ok) {
      if (previous)
        setState((current) => ({
          ...current,
          visits: current.visits.map((visit) =>
            visit.id === id ? previous : visit,
          ),
        }));
      const result = (await response.json()) as { error?: string };
      throw new Error(result.error ?? "No fue posible actualizar la visita");
    }
  }

  const value = useMemo<Ctx>(
    () => ({
      state,
      loading,
      error,
      production,
      createVisit,
      updateVisit,
      reload,
      reset: () => setState(initialDemoState),
    }),
    // Las funciones operan siempre sobre el estado de este render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state, loading, error, production],
  );
  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useDemo() {
  const context = useContext(DataContext);
  if (!context) throw new Error("DataProvider faltante");
  return context;
}
