import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(__dirname, "../../..");

function source(file: string) {
  return readFileSync(path.join(root, file), "utf8");
}

describe("exportaciones de Excel", () => {
  it("formatea entrada y salida en hora de Tijuana en cada descarga", () => {
    const visits = source("src/components/visits-table.tsx");
    const reports = source("src/components/reports.tsx");
    const people = source("src/components/people-admin.tsx");

    for (const file of [visits, reports, people]) {
      expect(file).toContain("formatReportDateTime");
      expect(file).toContain("downloadWorkbook");
      expect(file).not.toContain(".toISOString().slice");
    }

    expect(visits).toContain("when(visit.checkedInAt)");
    expect(visits).toContain("when(visit.checkedOutAt)");
    expect(visits).toContain("when(visit.startsAt)");
    expect(reports).toContain("when(visit.checkedInAt)");
    expect(reports).toContain("when(visit.checkedOutAt)");
    expect(reports).toContain("when(visit.startsAt)");
    expect(reports).toContain("when(visit.endsAt)");
    expect(people).toContain("formatReportDateTime(visit.checkedInAt)");
  });
});
