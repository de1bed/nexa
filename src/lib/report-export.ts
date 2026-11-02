import {
  APP_TIME_ZONE,
  calendarDateInTimeZone,
  resolveTimeZone,
} from "@/lib/timezone";

/**
 * Fecha y hora de los reportes descargados.
 * Siempre en America/Tijuana, con día/mes/año y a.m./p.m.
 * Ejemplo: 30/10/2026 12:47 p.m.
 */
export function formatReportDateTime(
  value: string | Date | null | undefined,
  timeZone: string = APP_TIME_ZONE,
) {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: resolveTimeZone(timeZone),
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hourCycle: "h12",
  }).formatToParts(date);
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";

  const day = read("day").padStart(2, "0");
  const month = read("month").padStart(2, "0");
  const year = read("year");
  const hour = String(Number(read("hour")));
  const minute = read("minute").padStart(2, "0");
  const period = read("dayPeriod").toLowerCase().startsWith("p")
    ? "p.m."
    : "a.m.";
  return `${day}/${month}/${year} ${hour}:${minute} ${period}`;
}

/** Fecha calendario de Tijuana para el nombre del archivo, no el día UTC. */
export function reportFileDate(at: Date = new Date(), timeZone = APP_TIME_ZONE) {
  return calendarDateInTimeZone(timeZone, at);
}

/** Ancho de columna legible: al menos el texto, con un mínimo cómodo. */
export function sheetColumnWidths(
  rows: string[][],
  minimum = 18,
  maximum = 46,
) {
  const count = rows.reduce((widest, row) => Math.max(widest, row.length), 0);
  return Array.from({ length: count }, (_, index) => {
    let width = minimum;
    for (const row of rows) {
      const length = [...String(row[index] ?? "")].length;
      if (length + 3 > width) width = length + 3;
    }
    return Math.min(width, maximum);
  });
}

/** Evita que Excel interprete un nombre como fórmula. */
export function safeSheetText(value: unknown) {
  const text = value == null ? "" : String(value);
  return /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
}

export type ReportSheet = {
  name: string;
  rows: unknown[][];
};

export async function workbookFromSheets(sheets: ReportSheet[]) {
  const { default: ExcelJS } = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "NEXA VISIT";
  for (const sheet of sheets) {
    const name =
      sheet.name.replace(/[\\/?*[\]:]/g, " ").trim().slice(0, 31) || "Reporte";
    const worksheet = workbook.addWorksheet(name);
    const rows = sheet.rows.map((row) => row.map(safeSheetText));
    for (const row of rows) worksheet.addRow(row);
    const widths = sheetColumnWidths(rows);
    worksheet.columns = widths.map((width) => ({ width }));
  }
  return workbook;
}

export async function downloadWorkbook(filename: string, sheets: ReportSheet[]) {
  const workbook = await workbookFromSheets(sheets);
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`;
  anchor.click();
  URL.revokeObjectURL(url);
}
