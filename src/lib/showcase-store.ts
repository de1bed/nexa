"use client";

import { initialShowcaseState } from "./demo-data";
import type { AccessEvent, Visit, WorkspaceState } from "./domain";

/**
 * Estado compartido del modo vitrina, expuesto como store externo para
 * consumirlo con `useSyncExternalStore`.
 *
 * Vive en `localStorage` para que el recorrido completo —anfitrión, visitante,
 * guardia y administración— se sostenga entre pestañas sin base de datos. No es
 * un mecanismo de seguridad: con credenciales de Supabase deja de usarse.
 */

const STORAGE_KEY = "nexa-visit-showcase-v3";
const CHANNEL = "nexa-visit-showcase";

const listeners = new Set<() => void>();

/**
 * `useSyncExternalStore` compara por identidad, así que el snapshot debe
 * conservar la misma referencia mientras el estado no cambie.
 */
let snapshot: WorkspaceState = initialShowcaseState;
let hydrated = false;

function readStorage(): WorkspaceState {
  if (typeof window === "undefined") return initialShowcaseState;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return initialShowcaseState;
    const parsed = JSON.parse(raw) as Partial<WorkspaceState>;
    if (!Array.isArray(parsed.visits)) return initialShowcaseState;
    return {
      visits: parsed.visits,
      events: Array.isArray(parsed.events) ? parsed.events : [],
    };
  } catch {
    return initialShowcaseState;
  }
}

function publish(next: WorkspaceState) {
  snapshot = next;
  listeners.forEach((listener) => listener());
}

export function loadShowcaseState(): WorkspaceState {
  if (!hydrated) {
    hydrated = true;
    snapshot = readStorage();
  }
  return snapshot;
}

export function getShowcaseSnapshot(): WorkspaceState {
  return snapshot;
}

/** En el servidor siempre se pinta el estado semilla, sin `localStorage`. */
export function getShowcaseServerSnapshot(): WorkspaceState {
  return initialShowcaseState;
}

export function saveShowcaseState(state: WorkspaceState) {
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      window.dispatchEvent(new CustomEvent(CHANNEL));
    } catch {
      // Almacenamiento lleno o bloqueado: el recorrido continúa en memoria.
    }
  }
  publish(state);
}

export function mutateShowcaseState(
  update: (state: WorkspaceState) => WorkspaceState,
) {
  const next = update(loadShowcaseState());
  saveShowcaseState(next);
  return next;
}

export function resetShowcaseState() {
  saveShowcaseState(initialShowcaseState);
  return initialShowcaseState;
}

/**
 * Suscripción al store. Al conectarse toma el valor de `localStorage`, de modo
 * que la primera lectura tras hidratar ya refleja lo guardado, y escucha los
 * cambios hechos en otras pestañas.
 */
export function subscribeShowcase(listener: () => void) {
  listeners.add(listener);

  const fromStorage = readStorage();
  hydrated = true;
  if (fromStorage !== snapshot) publish(fromStorage);

  const onExternal = () => publish(readStorage());
  window.addEventListener("storage", onExternal);
  window.addEventListener(CHANNEL, onExternal);

  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onExternal);
    window.removeEventListener(CHANNEL, onExternal);
  };
}

export function upsertShowcaseVisit(visit: Visit, event?: AccessEvent) {
  return mutateShowcaseState((state) => {
    const exists = state.visits.some((item) => item.id === visit.id);
    return {
      visits: exists
        ? state.visits.map((item) => (item.id === visit.id ? visit : item))
        : [visit, ...state.visits],
      events: event ? [event, ...state.events] : state.events,
    };
  });
}

export function patchShowcaseVisit(
  id: string,
  patch: Partial<Visit>,
  event?: Omit<AccessEvent, "id" | "visitId" | "at">,
) {
  return mutateShowcaseState((state) => ({
    visits: state.visits.map((visit) =>
      visit.id === id ? { ...visit, ...patch } : visit,
    ),
    events: event
      ? [
          {
            id: crypto.randomUUID(),
            visitId: id,
            at: new Date().toISOString(),
            ...event,
          },
          ...state.events,
        ]
      : state.events,
  }));
}

export function findShowcaseVisit(
  predicate: (visit: Visit) => boolean,
): Visit | undefined {
  return loadShowcaseState().visits.find(predicate);
}
