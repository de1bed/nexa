import { describe, expect, it } from "vitest";
import { PKPass } from "passkit-generator";

describe("pase de Apple Wallet", () => {
  it("sigue construyendo un eventTicket con passkit-generator 3.7", () => {
    const pass = new PKPass(
      {},
      undefined,
      {
        serialNumber: "qa-serial",
        description: "Pase de visitante",
        organizationName: "NEXA VISIT",
      },
    );
    pass.type = "eventTicket";
    expect(pass.type).toBe("eventTicket");
    pass.primaryFields.push({
      key: "visitor",
      label: "VISITANTE",
      value: "QA Visitante",
    });
    expect(pass.primaryFields[0]?.value).toBe("QA Visitante");
  });
});
