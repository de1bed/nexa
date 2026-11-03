import { describe, expect, it } from "vitest";
import { documentTypes } from "../domain";
import { parseSafetyDocuments } from "../safety-documents";
import { OTHER_PURPOSE, resolvedPurpose } from "../visit-purpose";
import { visitStartsInPast } from "../visit-schedule";

describe("mejoras de visita", () => {
  it("limita la identificación a INE, licencia y pasaporte", () => {
    expect([...documentTypes]).toEqual(["INE", "Licencia", "Pasaporte"]);
  });

  it("guarda el texto libre cuando el motivo es Otro", () => {
    expect(resolvedPurpose("Entrevista", "")).toBe("Entrevista");
    expect(resolvedPurpose(OTHER_PURPOSE, "  Entrega de planos  ")).toBe(
      "Entrega de planos",
    );
    expect(resolvedPurpose(OTHER_PURPOSE, "  ")).toBe("");
  });

  it("rechaza una hora de inicio que ya pasó", () => {
    const now = new Date("2026-11-03T18:00:00.000Z").getTime();
    expect(visitStartsInPast(new Date("2026-11-03T17:00:00.000Z"), now)).toBe(
      true,
    );
    expect(visitStartsInPast(new Date("2026-11-03T17:59:30.000Z"), now)).toBe(
      false,
    );
    expect(visitStartsInPast(new Date("2026-11-03T19:00:00.000Z"), now)).toBe(
      false,
    );
  });

  it("acepta documentos de seguridad con enlace https", () => {
    const documents = parseSafetyDocuments([
      {
        id: "11111111-1111-4111-8111-111111111111",
        title: "Reglamento de planta",
        body: "Casco obligatorio",
        url: "https://nexa.example/seguridad.pdf",
      },
      { id: "sin-titulo", title: "x", url: "http://inseguro.example" },
    ]);
    expect(documents).toEqual([
      {
        id: "11111111-1111-4111-8111-111111111111",
        title: "Reglamento de planta",
        body: "Casco obligatorio",
        url: "https://nexa.example/seguridad.pdf",
      },
    ]);
  });
});
