import { describe, expect, it } from "vitest";
import { formatDateTime, formatTime } from "../i18n";
import {
  APP_TIME_ZONE,
  calendarDateInTimeZone,
  formatDateTimeLabel,
  formatTimeLabel,
  resolveTimeZone,
  zonedDateTime,
  zonedDateTimeToIso,
} from "../timezone";

describe("zona horaria de la visita", () => {
  it("guarda 08:00-20:00 de Tijuana como UTC, no como hora del navegador", () => {
    // El 23 oct 2026 Tijuana sigue en PDT (UTC-7).
    expect(zonedDateTimeToIso("2026-10-23", "08:00", "America/Tijuana")).toBe(
      "2026-10-23T15:00:00.000Z",
    );
    expect(zonedDateTimeToIso("2026-10-23", "20:00", "America/Tijuana")).toBe(
      "2026-10-24T03:00:00.000Z",
    );
  });

  it("al pintar el instante vuelve a las horas capturadas", () => {
    const start = zonedDateTime("2026-10-23", "08:00", APP_TIME_ZONE);
    const end = zonedDateTime("2026-10-23", "20:00", APP_TIME_ZONE);
    expect(
      formatInZoneParts(start, { hour: "numeric", minute: "2-digit" }),
    ).toMatch(/8:00/);
    expect(
      formatInZoneParts(end, { hour: "numeric", minute: "2-digit" }),
    ).toMatch(/8:00/);
  });

  it("formatea la llegada 16:22 UTC como 9:22 a.m. en Tijuana", () => {
    const label = formatTimeLabel("2026-10-23T16:22:00.000Z", APP_TIME_ZONE);
    expect(label.toLowerCase()).toMatch(/9:22/);
    expect(label.toLowerCase()).not.toMatch(/4:22/);
  });

  it("formatea la fecha de la invitación en la zona de la sede", () => {
    const label = formatDateTimeLabel(
      "2026-10-23T15:00:00.000Z",
      "America/Tijuana",
    );
    expect(label.toLowerCase()).toMatch(/8:00/);
    expect(label).toMatch(/2026/);
  });

  it("muestra el horario en la zona de la sede y cae a Tijuana si no hay zona", () => {
    // 17:30 UTC es 10:30 en Tijuana (PDT) y 11:30 en Ciudad de México.
    const instant = "2026-10-26T17:30:00.000Z";
    expect(formatDateTime(instant, "es", "America/Tijuana").toLowerCase()).toMatch(
      /10:30/,
    );
    expect(
      formatDateTime(instant, "es", "America/Mexico_City").toLowerCase(),
    ).toMatch(/11:30/);
    expect(formatTime(instant, "es").toLowerCase()).toMatch(/10:30/);
    expect(formatTime(instant, "es").toLowerCase()).not.toMatch(/11:30/);
  });

  it("al guardar 11:30 de Tijuana el reloj de la sede vuelve a decir 11:30", () => {
    const stored = zonedDateTimeToIso("2026-10-26", "11:30", "America/Tijuana");
    expect(stored).toBe("2026-10-26T18:30:00.000Z");
    expect(formatTime(stored, "es", "America/Tijuana").toLowerCase()).toMatch(
      /11:30/,
    );
    expect(
      formatTime(stored, "es", "America/Mexico_City").toLowerCase(),
    ).toMatch(/12:30/);
  });

  it("rechaza una zona inventada y cae a Tijuana", () => {
    expect(resolveTimeZone("Not/A/Zone")).toBe(APP_TIME_ZONE);
    expect(resolveTimeZone("America/Mexico_City")).toBe("America/Mexico_City");
  });

  it("calcula el día calendario en la zona, no en UTC", () => {
    const lateUtc = new Date("2026-10-24T05:30:00.000Z");
    expect(calendarDateInTimeZone("America/Tijuana", lateUtc)).toBe(
      "2026-10-23",
    );
    expect(calendarDateInTimeZone("America/Tijuana", lateUtc, 1)).toBe(
      "2026-10-24",
    );
  });
});

function formatInZoneParts(
  value: Date,
  options: Intl.DateTimeFormatOptions,
) {
  return new Intl.DateTimeFormat("en-US", {
    ...options,
    timeZone: APP_TIME_ZONE,
  }).format(value);
}
