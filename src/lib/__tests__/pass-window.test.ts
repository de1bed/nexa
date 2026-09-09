import { describe, expect, it } from "vitest";
import { PASS_GRACE_AFTER_END_MS, passValidityWindow } from "../pass-window";

describe("ventana del QR", () => {
  it("empieza a valer en el instante de emisión, no una hora antes de la visita", () => {
    const issuedAt = new Date("2026-09-08T15:00:00.000Z");
    const window = passValidityWindow({
      startsAt: "2026-09-09T18:00:00.000Z",
      endsAt: "2026-09-09T19:00:00.000Z",
      issuedAt,
    });

    expect(window.valid_from).toBe(issuedAt.toISOString());
    expect(new Date(window.valid_from).getTime()).toBeLessThan(
      new Date("2026-09-09T17:00:00.000Z").getTime(),
    );
  });

  it("vence un día después del fin programado", () => {
    const window = passValidityWindow({
      startsAt: "2026-09-08T18:00:00.000Z",
      endsAt: "2026-09-08T19:00:00.000Z",
      issuedAt: "2026-09-08T12:00:00.000Z",
    });

    expect(new Date(window.expires_at).getTime()).toBe(
      new Date("2026-09-08T19:00:00.000Z").getTime() + PASS_GRACE_AFTER_END_MS,
    );
  });

  it("nunca vence antes de emitirse", () => {
    const issuedAt = new Date("2026-09-10T12:00:00.000Z");
    const window = passValidityWindow({
      startsAt: "2026-09-01T10:00:00.000Z",
      endsAt: "2026-09-01T11:00:00.000Z",
      issuedAt,
    });

    expect(new Date(window.expires_at).getTime()).toBeGreaterThan(
      issuedAt.getTime(),
    );
  });
});
