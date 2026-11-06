import { OTHER_PURPOSE, timeInsideMs, visitPurposes, type Visit } from "./domain";
import { localDayKey } from "./local-day";

/** Etiqueta para anfitriones sin departamento asignado. */
export const NO_DEPARTMENT = "Sin departamento";

/** Valor del filtro «Motivo» que agrupa los motivos escritos a mano («Otro»). */
export const OTHER_FILTER = "__other__";

/** Un motivo escrito por el anfitrión, fuera de la lista del menú. */
export function isCustomPurpose(purpose: string) {
  return (
    purpose === OTHER_PURPOSE ||
    !(visitPurposes as readonly string[]).includes(purpose)
  );
}

export type DepartmentRow = {
  name: string;
  visits: number;
  entries: number;
  insideNow: number;
  averageMs: number;
};

/**
 * Resumen por departamento del anfitrión: visitas del periodo, entradas
 * registradas en el rango, quién sigue dentro y estancia promedio.
 */
export function departmentSummary(rows: Visit[], from: string, to: string) {
  const byName = new Map<string, Visit[]>();
  for (const visit of rows) {
    const name = visit.hostDepartment || NO_DEPARTMENT;
    byName.set(name, [...(byName.get(name) ?? []), visit]);
  }
  const inRange = (iso?: string) => {
    if (!iso) return false;
    const day = localDayKey(iso);
    return day >= from && day <= to;
  };
  return [...byName.entries()]
    .map(([name, visits]): DepartmentRow => {
      const completed = visits.filter(
        (visit) => visit.checkedInAt && visit.checkedOutAt && inRange(visit.checkedOutAt),
      );
      return {
        name,
        visits: visits.length,
        entries: visits.filter((visit) => inRange(visit.checkedInAt)).length,
        insideNow: visits.filter((visit) => visit.status === "checked_in").length,
        averageMs: completed.length
          ? completed.reduce((total, visit) => total + timeInsideMs(visit), 0) /
            completed.length
          : 0,
      };
    })
    .sort((a, b) =>
      a.name === NO_DEPARTMENT
        ? 1
        : b.name === NO_DEPARTMENT
          ? -1
          : b.visits - a.visits || a.name.localeCompare(b.name, "es"),
    );
}

/** Las visitas ordenadas por departamento, y dentro de cada uno por fecha. */
export function groupByDepartment(rows: Visit[]) {
  const groups = new Map<string, Visit[]>();
  for (const visit of rows) {
    const name = visit.hostDepartment || NO_DEPARTMENT;
    groups.set(name, [...(groups.get(name) ?? []), visit]);
  }
  return [...groups.entries()]
    .sort(([a], [b]) =>
      a === NO_DEPARTMENT ? 1 : b === NO_DEPARTMENT ? -1 : a.localeCompare(b, "es"),
    )
    .map(([name, visits]) => ({
      name,
      visits: [...visits].sort(
        (x, y) => new Date(x.startsAt).getTime() - new Date(y.startsAt).getTime(),
      ),
    }));
}
