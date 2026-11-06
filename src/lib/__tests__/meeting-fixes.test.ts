import { describe, expect, it } from "vitest";
import { usernameFromBooth } from "../station-access";
import { localDayKey, localWeekKey } from "../local-day";
import {
  OTHER_PURPOSE,
  identityPhotosNeeded,
  isDocumentType,
  documentTypes,
  resolvePurpose,
  startsInThePast,
} from "../domain";
import { validateRegistration, parseVisitorFlow } from "../visitor-flow";

describe("usuario de la tableta", () => {
  it("usa el nombre de la caseta", () => {
    expect(usernameFromBooth("Caseta Norte")).toBe("caseta.norte");
  });

  it("si otra sede ya tiene una caseta con el mismo nombre, antepone la sede", () => {
    expect(
      usernameFromBooth("Caseta principal", {
        site: "Prueba",
        taken: ["caseta.principal"],
      }),
    ).toBe("prueba.caseta.principal");
  });

  it("si aun así choca, agrega un número", () => {
    expect(
      usernameFromBooth("Caseta principal", {
        site: "Prueba",
        taken: ["caseta.principal", "prueba.caseta.principal"],
      }),
    ).toBe("prueba.caseta.principal.2");
  });

  it("dos casetas de la misma sede (peatonal y vehicular) tienen usuarios distintos", () => {
    expect(usernameFromBooth("Acceso peatonal")).toBe("acceso.peatonal");
    expect(usernameFromBooth("Acceso vehicular")).toBe("acceso.vehicular");
  });
});

describe("día de Tijuana", () => {
  it("una entrada a las 11 p.m. en Tijuana cuenta en ese día, no en el siguiente", () => {
    // 2026-11-06 23:30 en Tijuana = 2026-11-07 07:30 UTC.
    expect(localDayKey("2026-11-07T07:30:00Z")).toBe("2026-11-06");
  });

  it("la semana empieza el lunes de Tijuana", () => {
    expect(localWeekKey("2026-11-08T20:00:00Z")).toBe("2026-11-02");
  });
});

describe("motivo de la visita y fechas", () => {
  it("«Otro» guarda lo que se escribió", () => {
    expect(resolvePurpose(OTHER_PURPOSE, "  Instalación de antena  ")).toBe(
      "Instalación de antena",
    );
    expect(resolvePurpose("Entrevista", "ignorado")).toBe("Entrevista");
  });

  it("no deja crear una visita que ya pasó", () => {
    const now = Date.parse("2026-11-06T18:00:00Z");
    expect(startsInThePast("2026-11-06T16:00:00Z", now)).toBe(true);
    expect(startsInThePast("2026-11-06T17:55:00Z", now)).toBe(false);
    expect(startsInThePast("2026-11-07T16:00:00Z", now)).toBe(false);
  });
});

describe("identificaciones aceptadas", () => {
  it("solo INE, licencia y pasaporte", () => {
    expect([...documentTypes]).toEqual(["INE / IFE", "Licencia de conducir", "Pasaporte"]);
    expect(isDocumentType("Credencial laboral")).toBe(false);
  });

  it("el pasaporte basta con una foto; INE y licencia piden dos", () => {
    expect(identityPhotosNeeded("Pasaporte")).toBe(1);
    expect(identityPhotosNeeded("INE / IFE")).toBe(2);
    const flow = parseVisitorFlow({ identity: "off", identification: "required", consent: "off" });
    const base = {
      fullName: "Ana Pérez",
      email: "",
      phone: "",
      company: "",
      vehiclePlate: "",
      visitorNotes: "",
      consent: true,
      vehiclePhotos: 0,
      attachmentItems: 0,
    };
    expect(
      validateRegistration({ ...base, identityPhotos: 1, documentType: "Pasaporte" }, flow),
    ).not.toBe("identity_photos_required");
    expect(
      validateRegistration({ ...base, identityPhotos: 1, documentType: "INE / IFE" }, flow),
    ).toBe("identity_photos_required");
  });
});
