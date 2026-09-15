import { describe, expect, it } from "vitest";
import {
  defaultVisitorFlow,
  extrasVisible,
  firstRegistrationStep,
  parseVisitorFlow,
  registrationSteps,
  requireIdentificationFromFlow,
  stepAfter,
  stepBefore,
  validateRegistration,
  visitorFlowFromIdentification,
} from "../visitor-flow";

const complete = {
  fullName: "Sofía Rivera",
  email: "sofia@example.test",
  phone: "5512345678",
  company: "Arco Studio",
  vehiclePlate: "ABC-1234",
  visitorNotes: "Llego con equipo",
  consent: true,
  identityPhotos: 2,
  vehiclePhotos: 1,
  attachmentPhotos: 1,
};

describe("política de registro", () => {
  it("conserva el flujo actual cuando no hay JSON", () => {
    expect(parseVisitorFlow(undefined, true)).toEqual(defaultVisitorFlow);
    expect(registrationSteps(defaultVisitorFlow)).toEqual([
      "identity",
      "document",
      "extras",
      "consent",
    ]);
    expect(extrasVisible(defaultVisitorFlow)).toBe(true);
  });

  it("apaga la identificación si la empresa ya lo tenía desactivado", () => {
    const flow = visitorFlowFromIdentification(false);
    expect(flow.identification).toBe("off");
    expect(registrationSteps(flow)).toEqual(["identity", "extras", "consent"]);
    expect(requireIdentificationFromFlow(flow)).toBe(false);
  });

  it("respeta el JSON guardado y no pisa identification con el flag viejo", () => {
    const flow = parseVisitorFlow(
      { identity: "optional", identification: "optional", attachments: "required" },
      true,
    );
    expect(flow.identity).toBe("optional");
    expect(flow.identification).toBe("optional");
    expect(flow.attachments).toBe("required");
    expect(flow.vehicle).toBe("optional");
    expect(registrationSteps(flow)).toEqual([
      "identity",
      "document",
      "extras",
      "attachments",
      "consent",
    ]);
  });

  it("abre un paso dedicado de vehículo solo cuando es obligatorio", () => {
    const flow = parseVisitorFlow({ vehicle: "required" });
    expect(registrationSteps(flow)).toEqual([
      "identity",
      "document",
      "vehicle",
      "extras",
      "consent",
    ]);
  });

  it("navega el wizard sin romper el orden", () => {
    const flow = defaultVisitorFlow;
    expect(firstRegistrationStep(flow)).toBe("identity");
    expect(stepAfter("identity", flow, false)).toBe("document");
    expect(stepAfter("document", flow, true)).toBe("review");
    expect(stepAfter("review", flow, true)).toBe("extras");
    expect(stepBefore("extras", flow, true)).toBe("review");
    expect(stepBefore("document", flow, false)).toBe("identity");
    expect(stepAfter("consent", flow, false)).toBe("done");
  });

  it("valida según la política, no con campos fijos", () => {
    expect(validateRegistration(complete, defaultVisitorFlow)).toBeNull();
    expect(
      validateRegistration(
        { ...complete, identityPhotos: 0 },
        defaultVisitorFlow,
      ),
    ).toBe("identity_photos_required");

    const optionalId = parseVisitorFlow({ identification: "optional" });
    expect(
      validateRegistration({ ...complete, identityPhotos: 0 }, optionalId),
    ).toBeNull();

    const requiredVehicle = parseVisitorFlow({ vehicle: "required" });
    expect(
      validateRegistration(
        { ...complete, vehiclePlate: "", vehiclePhotos: 0 },
        requiredVehicle,
      ),
    ).toBe("plate_required");
  });

  it("permite apagar los datos y el consentimiento", () => {
    const flow = parseVisitorFlow({
      identity: "off",
      identification: "off",
      vehicle: "off",
      notes: "off",
      attachments: "off",
      consent: "off",
    });
    expect(registrationSteps(flow)).toEqual([]);
    expect(
      validateRegistration(
        { ...complete, fullName: "", email: "", consent: false, identityPhotos: 0 },
        flow,
      ),
    ).toBeNull();
  });
});
