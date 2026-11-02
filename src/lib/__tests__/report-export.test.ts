import { describe, expect, it } from "vitest";
import {
  formatReportDateTime,
  reportFileDate,
  safeSheetText,
  sheetColumnWidths,
  workbookFromSheets,
} from "../report-export";

describe("fecha de reportes en Tijuana", () => {
  it("convierte el instante UTC a dd/mm/aaaa h:mm a.m./p.m.", () => {
    expect(
      formatReportDateTime("2026-10-30T19:47:32.149857+00:00"),
    ).toBe("30/10/2026 12:47 p.m.");
    expect(formatReportDateTime("2026-10-23T15:00:00.000Z")).toBe(
      "23/10/2026 8:00 a.m.",
    );
  });

  it("deja vacía una fecha ausente y no usa el día UTC en el archivo", () => {
    expect(formatReportDateTime(null)).toBe("");
    expect(formatReportDateTime("no-es-fecha")).toBe("");
    // 05:30 UTC del 24 sigue siendo 23 de octubre en Tijuana.
    expect(reportFileDate(new Date("2026-10-24T05:30:00.000Z"))).toBe(
      "2026-10-23",
    );
  });

  it("abre columnas anchas y neutraliza fórmulas", () => {
    const rows = [
      ["Visitante", "Entrada"],
      ["Ana López", "30/10/2026 12:47 p.m."],
    ];
    const widths = sheetColumnWidths(rows);
    expect(widths[0]).toBeGreaterThanOrEqual(18);
    expect(widths[1]).toBeGreaterThanOrEqual("30/10/2026 12:47 p.m.".length);
    expect(safeSheetText("=cmd|calc")).toBe("'=cmd|calc");
    expect(safeSheetText("30/10/2026 12:47 p.m.")).toBe("30/10/2026 12:47 p.m.");
  });

  it("escribe un xlsx con el ancho de columna aplicado", async () => {
    const rows = [
      ["Visitante", "Entrada", "Salida"],
      ["Mariana Ortiz", "30/10/2026 12:47 p.m.", "30/10/2026 2:10 p.m."],
    ];
    const workbook = await workbookFromSheets([{ name: "Bitácora", rows }]);
    const sheet = workbook.getWorksheet("Bitácora");
    expect(sheet?.getCell("B2").value).toBe("30/10/2026 12:47 p.m.");
    expect(sheet?.getColumn(2).width ?? 0).toBeGreaterThanOrEqual(18);
    const buffer = await workbook.xlsx.writeBuffer();
    expect(buffer.byteLength).toBeGreaterThan(1000);
  });
});
