import {
  normalizeCompanyCode,
  normalizeStationUsername,
} from "./station-access";

/** Clave fija de la empresa de ejemplo. El administrador la ve; el guardia no. */
export const DEMO_COMPANY_CODE = "NOVA-2026";

export type DemoStation = {
  id: string;
  username: string;
  boothId: string;
  boothName: string;
};

export const DEMO_STATIONS: DemoStation[] = [
  {
    id: "station-norte",
    username: "norte",
    boothId: "booth-tj-norte",
    boothName: "Caseta Norte",
  },
  {
    id: "station-proveedores",
    username: "proveedores",
    boothId: "booth-tj-proveedores",
    boothName: "Caseta de proveedores",
  },
];

const STORAGE_KEY = "nexa-station-users";

export function readExtraStations(): DemoStation[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as DemoStation[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveExtraStation(entry: DemoStation) {
  const next = [
    entry,
    ...readExtraStations().filter((item) => item.id !== entry.id),
  ];
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

export function listDemoStations(): DemoStation[] {
  const extra = readExtraStations();
  const seededIds = new Set(DEMO_STATIONS.map((item) => item.username));
  return [
    ...DEMO_STATIONS,
    ...extra.filter((item) => !seededIds.has(item.username)),
  ];
}

export function findDemoStation(companyCode: string, username: string) {
  if (normalizeCompanyCode(companyCode) !== normalizeCompanyCode(DEMO_COMPANY_CODE))
    return null;
  const name = normalizeStationUsername(username);
  return (
    listDemoStations().find((station) => station.username === name) ?? null
  );
}

export function findSeededStation(companyCode: string, username: string) {
  if (normalizeCompanyCode(companyCode) !== normalizeCompanyCode(DEMO_COMPANY_CODE))
    return null;
  const name = normalizeStationUsername(username);
  return DEMO_STATIONS.find((station) => station.username === name) ?? null;
}
