/**
 * Reloj compartido para los contadores de tiempo en vivo.
 *
 * Un solo intervalo alimenta todos los cronómetros de la aplicación (personas
 * dentro, duración de una visita, pase activo) en lugar de uno por componente,
 * y se expone como store externo para leerlo con `useSyncExternalStore`.
 */

const TICK_MS = 30000;

let current = Date.now();
let timer: ReturnType<typeof setInterval> | null = null;
const listeners = new Set<() => void>();

function start() {
  if (timer) return;
  timer = setInterval(() => {
    current = Date.now();
    listeners.forEach((listener) => listener());
  }, TICK_MS);
}

function stop() {
  if (!timer || listeners.size > 0) return;
  clearInterval(timer);
  timer = null;
}

export function subscribeClock(listener: () => void) {
  listeners.add(listener);
  current = Date.now();
  start();
  return () => {
    listeners.delete(listener);
    stop();
  };
}

export function getClock() {
  return current;
}

/** En el servidor no hay reloj vivo: los cronómetros se pintan tras hidratar. */
export function getServerClock() {
  return null;
}
