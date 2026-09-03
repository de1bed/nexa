import { describe, expect, it } from "vitest";
import {
  checkDigit,
  findMrzLines,
  isExpired,
  normalizeMrzLine,
  parseMrzDate,
  parseMrzName,
  parseTd1,
  readMrz,
} from "../ocr/mrz";

/**
 * Ejemplo canónico de la norma ICAO 9303 (parte 5, formato TD1).
 * Al ser una referencia externa, valida el algoritmo de dígitos de control
 * sin depender de nuestra propia implementación para generarlos.
 */
const ICAO_TD1 = [
  "I<UTOD231458907<<<<<<<<<<<<<<<",
  "7408122F1204159UTO<<<<<<<<<<<6",
  "ERIKSSON<<ANNA<MARIA<<<<<<<<<<",
];

describe("dígitos de control ICAO 9303", () => {
  it("calcula el control del número de documento", () => {
    expect(checkDigit("D23145890")).toBe(7);
  });

  it("calcula el control de las fechas", () => {
    expect(checkDigit("740812")).toBe(2);
    expect(checkDigit("120415")).toBe(9);
  });

  it("trata el relleno como cero", () => {
    expect(checkDigit("<<<<<<")).toBe(0);
  });
});

describe("lectura TD1", () => {
  const result = parseTd1(ICAO_TD1, new Date("2026-09-02"));

  it("interpreta todos los campos", () => {
    expect(result).not.toBeNull();
    expect(result).toMatchObject({
      documentCode: "I",
      issuingState: "UTO",
      documentNumber: "D23145890",
      nationality: "UTO",
      sex: "F",
      birthDate: "1974-08-12",
      expiryDate: "2012-04-15",
      surnames: "ERIKSSON",
      givenNames: "ANNA MARIA",
      fullName: "ANNA MARIA ERIKSSON",
    });
  });

  it("confirma la lectura con los cuatro dígitos de control", () => {
    expect(result!.checks).toEqual({
      documentNumber: "valid",
      birthDate: "valid",
      expiryDate: "valid",
      composite: "valid",
    });
    expect(result!.verified).toBe(true);
    expect(result!.confidence).toBe(100);
  });

  it("detecta una credencial vencida", () => {
    expect(isExpired(result!, new Date("2026-09-02"))).toBe(true);
    expect(isExpired(result!, new Date("2010-01-01"))).toBe(false);
  });

  it("marca la lectura como no verificada si un dígito no cuadra", () => {
    const corrupted = [...ICAO_TD1];
    // Se altera el número de documento sin recalcular su dígito de control.
    corrupted[0] = "I<UTOD231458917<<<<<<<<<<<<<<<";
    const bad = parseTd1(corrupted);
    expect(bad!.checks.documentNumber).toBe("invalid");
    expect(bad!.verified).toBe(false);
    expect(bad!.confidence).toBeLessThan(100);
  });

  it("rechaza una banda incompleta", () => {
    expect(parseTd1(ICAO_TD1.slice(0, 2))).toBeNull();
  });
});

describe("tolerancia al ruido del OCR", () => {
  it("normaliza separadores y relleno", () => {
    expect(normalizeMrzLine("I UTO-D23145890 7")).toContain("I<UTO");
    expect(normalizeMrzLine("abc")).toHaveLength(30);
  });

  it("descarta acentos y símbolos que el MRZ no usa", () => {
    expect(normalizeMrzLine("ERIKSSÓN<<ÁNNA")).not.toMatch(/[ÓÁ]/);
  });

  it("corrige confusiones de letra y dígito en las fechas", () => {
    // El OCR suele devolver O por 0, I por 1 y S por 5.
    expect(parseMrzDate("74O8I2", "birth", new Date("2026-01-01"))).toBe(
      "1974-08-12",
    );
    expect(parseMrzDate("I2O4I5", "expiry")).toBe("2012-04-15");
  });

  it("descarta fechas imposibles", () => {
    expect(parseMrzDate("749912", "birth")).toBeUndefined();
    expect(parseMrzDate("74", "birth")).toBeUndefined();
  });

  it("encuentra la banda dentro del texto completo del reverso", () => {
    const noisy = [
      "INSTITUTO NACIONAL ELECTORAL",
      "Credencial para votar",
      "",
      ...ICAO_TD1,
    ].join("\n");

    const lines = findMrzLines(noisy);
    expect(lines).not.toBeNull();
    expect(lines![0]).toBe(ICAO_TD1[0]);

    const parsed = readMrz(noisy, new Date("2026-09-02"));
    expect(parsed?.verified).toBe(true);
    expect(parsed?.fullName).toBe("ANNA MARIA ERIKSSON");
  });

  it("devuelve null cuando no hay banda legible", () => {
    expect(readMrz("Credencial para votar\nMEXICO")).toBeNull();
  });
});

describe("nombres", () => {
  it("separa apellidos de nombres y los ordena en español", () => {
    expect(parseMrzName("PEREZ<GOMEZ<<JUAN<CARLOS")).toEqual({
      surnames: "PEREZ GOMEZ",
      givenNames: "JUAN CARLOS",
      fullName: "JUAN CARLOS PEREZ GOMEZ",
    });
  });

  it("tolera un solo apellido", () => {
    expect(parseMrzName("LOPEZ<<ANA").fullName).toBe("ANA LOPEZ");
  });
});

describe("datos opcionales", () => {
  // Banda sintética con la forma de una credencial mexicana. Los tres renglones
  // miden exactamente 30 caracteres, como exige TD1.
  const MEX_TD1 = [
    "IDMEX1234567890RIVS920418MDF<<",
    "9204185F3012319MEXRVSF09<<<<<0",
    "RIVERA<SOTO<<SOFIA<<<<<<<<<<<<",
  ];

  it("usa renglones de la longitud que fija la norma", () => {
    MEX_TD1.forEach((line) => expect(line).toHaveLength(30));
  });

  it("extrae la CURP aunque venga partida entre los dos campos", () => {
    // La CURP (18 caracteres) no cabe en un solo campo opcional, así que se
    // reparte entre el de cada renglón.
    const result = parseTd1(MEX_TD1, new Date("2026-09-02"));

    expect(result!.curp).toBe("RIVS920418MDFRVSF0");
    expect(result!.curp).toHaveLength(18);
    expect(result!.fullName).toBe("SOFIA RIVERA SOTO");
    expect(result!.birthDate).toBe("1992-04-18");
    expect(result!.expiryDate).toBe("2030-12-31");
    expect(result!.sex).toBe("F");
  });

  it("no confunde el dígito de control compuesto con datos opcionales", () => {
    // La última posición del segundo renglón es control, no contenido.
    const withCheck = [...MEX_TD1];
    withCheck[1] = `${MEX_TD1[1].slice(0, 29)}7`;

    const result = parseTd1(withCheck);
    expect(result!.optionalData).not.toContain("7");
  });
});
