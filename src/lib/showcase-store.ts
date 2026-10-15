"use client";

import { getInitialShowcaseState } from "./demo-data";
import type { AccessEvent, Booth, Visit, WorkspaceState } from "./domain";

/**
 * Estado compartido del modo vitrina, expuesto como store externo para
 * consumirlo con `useSyncExternalStore`.
 *
 * Vive en `localStorage` para que el recorrido completo —anfitrión, visitante,
 * guardia y administración— se sostenga entre pestañas sin base de datos. No es
 * un mecanismo de seguridad: con credenciales de Supabase deja de usarse.
 */

const STORAGE_KEY = "nexa-visit-showcase-v3";
const BOOTH_KEY = "nexa-visit-showcase-booths";
const CHANNEL = "nexa-visit-showcase";

const listeners = new Set<() => void>();

/**
 * `useSyncExternalStore` compara por identidad, así que el snapshot debe
 * conservar la misma referencia mientras el estado no cambie.
 */
let snapshot: WorkspaceState = getInitialShowcaseState();
let hydrated = false;

function readStorage(): WorkspaceState {
  const seed = getInitialShowcaseState();
  if (typeof window === "undefined") return seed;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return seed;
    const parsed = JSON.parse(raw) as Partial<WorkspaceState>;
    if (!Array.isArray(parsed.visits)) return seed;
    return {
      visits: parsed.visits,
      events: Array.isArray(parsed.events) ? parsed.events : [],
    };
  } catch {
    return seed;
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
  return getInitialShowcaseState();
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

const boothListeners = new Set<() => void>();
const emptyBooths: Booth[] = [];
let boothSnapshot: Booth[] = emptyBooths;
let boothsHydrated = false;

function readBoothStorage(): Booth[] {
  if (typeof window === "undefined") return emptyBooths;
  try {
    const raw = window.localStorage.getItem(BOOTH_KEY);
    if (!raw) return emptyBooths;
    const parsed = JSON.parse(raw) as Booth[];
    return Array.isArray(parsed) ? parsed : emptyBooths;
  } catch {
    return emptyBooths;
  }
}

function publishBooths(next: Booth[]) {
  boothSnapshot = next;
  boothListeners.forEach((listener) => listener());
}

export type DemoChange = {
  id: string;
  at: string;
  actor: string;
  eventType: string;
  name?: string;
};

const CHANGE_KEY = "nexa-visit-showcase-changes";
const emptyChanges: DemoChange[] = [];
let changeSnapshot: DemoChange[] = emptyChanges;
let changesHydrated = false;
const changeListeners = new Set<() => void>();

function readChangeStorage(): DemoChange[] {
  if (typeof window === "undefined") return emptyChanges;
  try {
    const raw = window.localStorage.getItem(CHANGE_KEY);
    if (!raw) return emptyChanges;
    const parsed = JSON.parse(raw) as DemoChange[];
    return Array.isArray(parsed) ? parsed : emptyChanges;
  } catch {
    return emptyChanges;
  }
}

function publishChanges(next: DemoChange[]) {
  changeSnapshot = next;
  changeListeners.forEach((listener) => listener());
}

export function getDemoChangeSnapshot(): DemoChange[] {
  if (!changesHydrated && typeof window !== "undefined") {
    changesHydrated = true;
    changeSnapshot = readChangeStorage();
  }
  return changeSnapshot;
}

export function getDemoChangeServerSnapshot(): DemoChange[] {
  return emptyChanges;
}

export function subscribeDemoChanges(listener: () => void) {
  changeListeners.add(listener);
  const fromStorage = readChangeStorage();
  changesHydrated = true;
  if (fromStorage !== changeSnapshot) changeSnapshot = fromStorage;
  const onExternal = () => publishChanges(readChangeStorage());
  window.addEventListener("storage", onExternal);
  return () => {
    changeListeners.delete(listener);
    window.removeEventListener("storage", onExternal);
  };
}

export function appendDemoChange(entry: Omit<DemoChange, "id" | "at">) {
  const next = [
    {
      id: crypto.randomUUID(),
      at: new Date().toISOString(),
      ...entry,
    },
    ...getDemoChangeSnapshot(),
  ].slice(0, 200);
  try {
    window.localStorage.setItem(CHANGE_KEY, JSON.stringify(next));
  } catch {
    // Sigue en memoria aunque no se pueda persistir.
  }
  publishChanges(next);
}

export function resetShowcaseState() {
  const seed = getInitialShowcaseState();
  saveShowcaseState(seed);
  try {
    window.localStorage.removeItem(BOOTH_KEY);
    window.localStorage.removeItem(CHANGE_KEY);
  } catch {
    // Sin almacenamiento, el reinicio igual borra las visitas.
  }
  publishBooths(emptyBooths);
  publishChanges(emptyChanges);
  return seed;
}

/** Misma referencia mientras las casetas de demostración no cambien. */
export function getDemoBoothSnapshot(): Booth[] {
  if (!boothsHydrated && typeof window !== "undefined") {
    boothsHydrated = true;
    boothSnapshot = readBoothStorage();
  }
  return boothSnapshot;
}

export function getDemoBoothServerSnapshot(): Booth[] {
  return emptyBooths;
}

export function readDemoBooths(): Booth[] {
  return getDemoBoothSnapshot();
}

export function subscribeDemoBooths(listener: () => void) {
  boothListeners.add(listener);
  const fromStorage = readBoothStorage();
  boothsHydrated = true;
  if (fromStorage !== boothSnapshot) boothSnapshot = fromStorage;

  const onExternal = () => publishBooths(readBoothStorage());
  window.addEventListener("storage", onExternal);
  return () => {
    boothListeners.delete(listener);
    window.removeEventListener("storage", onExternal);
  };
}

/** Alta o edición de una caseta en la demostración. Se recuerda en este navegador. */
export function upsertDemoBooth(booth: Booth) {
  const current = getDemoBoothSnapshot();
  const next = current.some((item) => item.id === booth.id)
    ? current.map((item) => (item.id === booth.id ? booth : item))
    : [...current, booth];
  try {
    window.localStorage.setItem(BOOTH_KEY, JSON.stringify(next));
  } catch {
    // Sigue en memoria de la página aunque no se pueda persistir.
  }
  publishBooths(next);
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
