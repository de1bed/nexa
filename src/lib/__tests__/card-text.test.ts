import { describe, expect, it } from "vitest";
import { pickPrintedIdentity } from "../ocr/card-text";

const FRONT = `
INSTITUTO NACIONAL ELECTORAL
MEXICO
NOMBRE
GARCIA
LOPEZ
JUAN CARLOS
DOMICILIO
CALLE MORELOS 12
CLAVE DE ELECTOR
GRLPJN80010109H800
CURP
GALJ800101HNLRLN09
`;

describe("nombre impreso de la INE", () => {
  it("arma el nombre que está debajo de NOMBRE", () => {
    expect(pickPrintedIdentity(FRONT).fullName).toBe(
      "Juan Carlos Garcia Lopez",
    );
  });

  it("toma la clave de elector como folio", () => {
    expect(pickPrintedIdentity(FRONT).documentNumber).toBe("GRLPJN80010109H800");
  });

  it("no inventa un nombre si la foto no trae el bloque", () => {
    expect(pickPrintedIdentity("solo un carro azul").fullName).toBeUndefined();
  });

  it("no usa el encabezado del instituto como nombre", () => {
    expect(
      pickPrintedIdentity("INSTITUTO NACIONAL ELECTORAL\nMEXICO").fullName,
    ).toBeUndefined();
  });

  it("arma el bloque en mayúsculas aunque no lea la palabra NOMBRE", () => {
    expect(
      pickPrintedIdentity("GARCIA\nLOPEZ\nJUAN CARLOS").fullName,
    ).toBe("Juan Carlos Garcia Lopez");
  });

  it("reconoce la etiqueta aunque un cero reemplace la O", () => {
    expect(pickPrintedIdentity("N0MBRE\nGARCIA\nLOPEZ\nJUAN").fullName).toBe(
      "Juan Garcia Lopez",
    );
  });
});
