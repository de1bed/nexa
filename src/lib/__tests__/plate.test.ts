import { describe, expect, it } from "vitest";
import { pickPlate } from "../ocr/plate";

describe("placas mexicanas", () => {
  it("arma la placa clásica de tres letras y cuatro números", () => {
    expect(pickPlate("MEXICO\nABC 1234")).toBe("ABC-1234");
  });

  it("conserva una letra en el bloque final", () => {
    expect(pickPlate("placa ABC-12-3A")).toBe("ABC-12-3A");
  });

  it("lee el formato de tres números y tres letras", () => {
    expect(pickPlate("frente 123ABC")).toBe("123-ABC");
  });

  it("corrige un 8 leído donde iba una letra", () => {
    expect(pickPlate("A8C-12-34")).toBe("ABC-1234");
  });

  it("corrige una I leída donde iba un número", () => {
    expect(pickPlate("ABC I234")).toBe("ABC-1234");
  });

  it("no inventa una placa si el texto no trae una", () => {
    expect(pickPlate("credencial para votar")).toBeNull();
  });
});
