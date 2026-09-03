import { beforeEach, describe, expect, it } from "vitest";
import {
  checkIn,
  checkOut,
  createManualVisit,
  deny,
  expiredDocumentIds,
  resolveInvitation,
  resolveQr,
  revokeQr,
  staleVisitIds,
} from "../visit-service";
import { initialShowcaseState } from "../demo-data";
import type { Visit } from "../domain";

let visit: Visit;

beforeEach(() => {
  visit = {
    ...initialShowcaseState.visits[2],
    status: "approved",
    startsAt: "2026-08-27T10:00:00.000Z",
    endsAt: "2026-08-27T11:00:00.000Z",
    checkedInAt: undefined,
    checkedOutAt: undefined,
    qrToken: "secret-pass",
  };
});

describe("enlaces de invitación", () => {
  it("resuelve una invitación vigente", () => {
    const result = resolveInvitation(
      initialShowcaseState,
      "nexa-demo-invitation-2026",
      new Date(initialShowcaseState.visits[0].startsAt),
    );
    expect(result).toMatchObject({ ok: true });
  });

  it("rechaza un token inexistente", () => {
    expect(resolveInvitation(initialShowcaseState, "no-existe")).toEqual({
      ok: false,
      code: "invalid",
    });
  });

  it("expira el enlace un día después de la visita", () => {
    expect(
      resolveInvitation(
        initialShowcaseState,
        "nexa-demo-invitation-2026",
        new Date("2099-01-01"),
      ),
    ).toEqual({ ok: false, code: "expired" });
  });
});

describe("pases QR", () => {
  it("resuelve el token sin exponer datos personales", () => {
    const result = resolveQr(
      { visits: [visit], events: [] },
      "secret-pass",
      new Date("2026-08-27T10:30:00Z"),
    );
    expect(result).toMatchObject({ ok: true, value: { window: "valid" } });
  });

  it("marca fuera de ventana cuando la llegada es muy anticipada", () => {
    const result = resolveQr(
      { visits: [visit], events: [] },
      "secret-pass",
      new Date("2026-08-27T08:00:00Z"),
    );
    expect(result).toMatchObject({ ok: true, value: { window: "outside" } });
  });

  it("rechaza un QR revocado", () => {
    expect(
      resolveQr({ visits: [revokeQr(visit)], events: [] }, "secret-pass"),
    ).toEqual({ ok: false, code: "invalid" });
  });
});

describe("decisiones de acceso", () => {
  it("registra la entrada dentro de la ventana", () => {
    expect(checkIn(visit, new Date("2026-08-27T10:10:00Z"))).toMatchObject({
      ok: true,
      value: { status: "checked_in" },
    });
  });

  it("evita una entrada duplicada", () => {
    expect(
      checkIn({ ...visit, status: "checked_in" }, new Date("2026-08-27T10:10:00Z")),
    ).toEqual({ ok: false, code: "duplicate_check_in" });
  });

  it("bloquea la entrada fuera de la ventana salvo autorización explícita", () => {
    const late = new Date("2026-08-27T14:00:00Z");
    expect(checkIn(visit, late)).toEqual({ ok: false, code: "outside_window" });
    expect(checkIn(visit, late, true)).toMatchObject({ ok: true });
  });

  it("respeta las tolerancias configuradas por la organización", () => {
    const early = new Date("2026-08-27T09:20:00Z");
    expect(checkIn(visit, early)).toEqual({ ok: false, code: "outside_window" });
    expect(
      checkIn(visit, early, false, { earlyMinutes: 60, lateMinutes: 30 }),
    ).toMatchObject({ ok: true });
  });

  it("registra la salida y revoca el pase", () => {
    const inside = {
      ...visit,
      status: "checked_in" as const,
      checkedInAt: "2026-08-27T10:10:00Z",
    };
    const result = checkOut(inside, new Date("2026-08-27T11:00:00Z"));
    expect(result).toMatchObject({
      ok: true,
      value: { status: "checked_out", qrToken: undefined },
    });
    if (result.ok)
      expect(checkOut(result.value)).toEqual({
        ok: false,
        code: "duplicate_check_out",
      });
  });

  it("exige un motivo para denegar el acceso", () => {
    expect(deny(visit, "   ")).toEqual({ ok: false, code: "reason_required" });
    expect(deny(visit, "Sin identificación")).toMatchObject({
      ok: true,
      value: { status: "denied", qrToken: undefined },
    });
  });

  it("crea un registro manual ya dentro de las instalaciones", () => {
    expect(
      createManualVisit({
        visitorName: "Prueba",
        email: "",
        company: "Demo",
        hostName: "Mateo",
        hostId: "host-1",
        location: "Recepción",
        purpose: "Entrega",
      }),
    ).toMatchObject({ origin: "guard_manual", status: "checked_in" });
  });
});

describe("mantenimiento", () => {
  it("selecciona solo documentos vencidos y no borrados", () => {
    expect(
      expiredDocumentIds(
        [
          { id: "a", retentionExpiresAt: "2020-01-01" },
          { id: "b", retentionExpiresAt: "2099-01-01" },
          {
            id: "c",
            retentionExpiresAt: "2020-01-01",
            deletedAt: "2020-01-02",
          },
        ],
        new Date("2026-01-01"),
      ),
    ).toEqual(["a"]);
  });

  it("marca vencidas las visitas que nadie usó", () => {
    const stale: Visit = {
      ...visit,
      id: "stale",
      status: "invited",
      endsAt: "2026-08-01T10:00:00.000Z",
    };
    const fresh: Visit = { ...visit, id: "fresh", status: "invited" };
    expect(
      staleVisitIds([stale, fresh], new Date("2026-08-27T10:00:00.000Z")),
    ).toEqual(["stale"]);
  });
});
