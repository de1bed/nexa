import type { AccessEvent, Booth, Visit } from "./domain";

/** Mensaje estable: la API y la caseta lo muestran tal cual. */
export const BOOTH_REQUIRED = "Elige la caseta antes de registrar el acceso";

/**
 * Caseta con la que se va a registrar un acceso.
 * Una sola caseta en la sede se usa sola, para no agregar un paso.
 * Varias casetas exigen elección en la entrada y en el rechazo.
 * La salida sigue pudiendo registrarse sin caseta, como hasta ahora.
 */
export function resolveRecordingBooth(input: {
  booths: Booth[];
  boothId?: string;
  locationId?: string;
  decision: "check_in" | "check_out" | "deny";
}): Booth | undefined {
  const active = input.booths.filter((booth) => booth.active);
  if (input.boothId) {
    const chosen = active.find((booth) => booth.id === input.boothId);
    if (!chosen) throw new Error("La caseta no está disponible");
    if (input.locationId && chosen.locationId !== input.locationId)
      throw new Error("La caseta no pertenece a esa sede");
    return chosen;
  }

  const atSite = input.locationId
    ? active.filter((booth) => booth.locationId === input.locationId)
    : active;
  if (atSite.length === 1) return atSite[0];
  if (atSite.length > 1 && input.decision !== "check_out")
    throw new Error(BOOTH_REQUIRED);
  return undefined;
}

/** Nombre de caseta que ve el auditor: la de la entrada, o la del rechazo. */
export function recordedBooth(visit: Visit): string {
  return visit.checkInBooth || visit.denialBooth || "";
}

/**
 * Guardia asentado en la visita. Si el registro es anterior a ese campo,
 * se toma del evento, que ya guardaba el nombre.
 */
export function recordedGuard(
  visit: Visit,
  events: AccessEvent[],
  kind: "in" | "out" | "deny",
): string {
  const stamped =
    kind === "in"
      ? visit.checkInBy
      : kind === "out"
        ? visit.checkOutBy
        : visit.deniedBy;
  if (stamped) return stamped;
  const type =
    kind === "in" ? "check_in" : kind === "out" ? "check_out" : "denied";
  return (
    events.find((event) => event.visitId === visit.id && event.type === type)
      ?.actor ?? ""
  );
}
