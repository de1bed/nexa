import { describe, expect, it } from "vitest";
import { passIsReusable } from "../pass-reuse";

describe("pase reutilizable", () => {
  it("deja entrar otra vez si cubre varias sedes o varios días", () => {
    expect(passIsReusable({ allLocations: true, passValidDays: 1 })).toBe(true);
    expect(
      passIsReusable({
        allLocations: false,
        passValidDays: 1,
        accessLocationCount: 2,
      }),
    ).toBe(true);
    expect(passIsReusable({ allLocations: false, passValidDays: 3 })).toBe(true);
  });

  it("cierra el pase de un solo uso al salir", () => {
    expect(
      passIsReusable({
        allLocations: false,
        passValidDays: 1,
        accessLocationCount: 0,
      }),
    ).toBe(false);
  });
});
