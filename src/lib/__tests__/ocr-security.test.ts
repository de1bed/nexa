import { describe, expect, it } from "vitest";
import { MockOCRProvider } from "../ocr/mock";
import { LOW_CONFIDENCE } from "../ocr/types";
import { parseTd1 } from "../ocr/mrz";
import {
  accessWindow,
  formatDuration,
  formatIsoDate,
  timeInsideMs,
} from "../domain";
import type { Visit } from "../domain";

describe("OCR", () => {
  it("entrega una banda MRZ bien formada y comprobada", async () => {
    const result = await new MockOCRProvider().extractIdentityData(
      new File(["imagen"], "id.jpg", { type: "image/jpeg" }),
    );

    // El proveedor reproducible construye la banda con dígitos de control
    // correctos, así que recorre el mismo camino que el motor real.
    expect(result.mrz?.verified).toBe(true);
    expect(result.confidence).toBe(100);
    expect(result.fullName).toBe("SOFIA RIVERA SOTO");
    expect(result.birthDate).toBe("1992-04-18");
    expect(result.expiryDate).toBe("2030-12-31");
    expect(result.expired).toBe(false);
    expect(result.rawText).toContain("INSTITUTO NACIONAL ELECTORAL");
  });

  it("marca revisión cuando la lectura no queda comprobada", () => {
    // Una banda con un dígito de control alterado debe quedar por debajo del
    // umbral para que la interfaz pida confirmación al visitante.
    const corrupted = parseTd1([
      "I<UTOD231458917<<<<<<<<<<<<<<<",
      "7408122F1204159UTO<<<<<<<<<<<6",
      "ERIKSSON<<ANNA<MARIA<<<<<<<<<<",
    ]);

    expect(corrupted!.verified).toBe(false);
    expect(corrupted!.confidence).toBeLessThan(LOW_CONFIDENCE);
  });
});

describe("cálculo de estancia", () => {
  const base: Pick<Visit, "checkedInAt" | "checkedOutAt"> = {
    checkedInAt: "2026-08-27T10:00:00.000Z",
    checkedOutAt: "2026-08-27T11:30:00.000Z",
  };

  it("mide el tiempo entre entrada y salida", () => {
    expect(timeInsideMs(base as Visit)).toBe(90 * 60000);
  });

  it("cuenta hasta ahora cuando la visita sigue dentro", () => {
    const open = { checkedInAt: "2026-08-27T10:00:00.000Z" } as Visit;
    const now = new Date("2026-08-27T10:45:00.000Z").getTime();
    expect(timeInsideMs(open, now)).toBe(45 * 60000);
  });

  it("no cuenta tiempo si nunca entró", () => {
    expect(timeInsideMs({} as Visit)).toBe(0);
  });

  it("formatea la duración de forma legible", () => {
    expect(formatDuration(90 * 60000)).toBe("1 h 30 min");
    expect(formatDuration(45 * 60000)).toBe("45 min");
    expect(formatDuration(120 * 60000)).toBe("2 h");
    expect(formatDuration(20000)).toBe("menos de 1 min");
  });
});

describe("fechas sin hora", () => {
  it("conserva el día aunque la zona horaria esté al oeste de Greenwich", () => {
    // Una vigencia «2030-12-31» debe leerse como 31 de diciembre, no como 30:
    // interpretarla en hora local retrocedía un día.
    expect(formatIsoDate("2030-12-31")).toContain("31");
    expect(formatIsoDate("2030-12-31")).toContain("diciembre");
    expect(formatIsoDate("1992-04-18")).toContain("18");
  });
});

describe("ventana de acceso", () => {
  const visit = {
    startsAt: "2026-08-27T10:00:00.000Z",
    endsAt: "2026-08-27T11:00:00.000Z",
  };

  it("clasifica llegada anticipada, válida y tardía", () => {
    expect(
      accessWindow(visit, { now: new Date("2026-08-27T09:00:00Z") }),
    ).toBe("early");
    expect(
      accessWindow(visit, { now: new Date("2026-08-27T10:30:00Z") }),
    ).toBe("valid");
    expect(
      accessWindow(visit, { now: new Date("2026-08-27T12:00:00Z") }),
    ).toBe("late");
  });

  it("usa las tolerancias configuradas por la organización", () => {
    expect(
      accessWindow(visit, {
        now: new Date("2026-08-27T09:00:00Z"),
        earlyMinutes: 90,
      }),
    ).toBe("valid");
  });
});
