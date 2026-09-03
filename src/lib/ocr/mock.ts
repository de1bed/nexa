import type { OCRProvider, OCRResult } from "./types";
import { checkDigit, isExpired, parseTd1 } from "./mrz";

/**
 * Proveedor reproducible para desarrollo, demostraciones y pruebas E2E.
 *
 * En vez de devolver campos inventados, arma una banda MRZ TD1 **con dígitos de
 * control correctos** y la interpreta con el mismo lector que usa el motor real.
 * Así el recorrido de la interfaz —incluida la insignia de lectura verificada—
 * es exactamente el que se verá en producción.
 */

const FILLER = "<";

function pad(value: string, length: number) {
  return value.slice(0, length).padEnd(length, FILLER);
}

/** Construye los tres renglones de una credencial ficticia pero bien formada. */
function buildSampleMrz() {
  const documentNumber = pad("123456789", 9);
  const optional1 = pad("RIVS920418MDF", 15);
  const birthDate = "920418";
  const expiryDate = "301231";
  const optional2 = pad("RVSF09", 11);

  const line1 = `IDMEX${documentNumber}${checkDigit(documentNumber)}${optional1}`;

  const head = `${birthDate}${checkDigit(birthDate)}F${expiryDate}${checkDigit(expiryDate)}MEX${optional2}`;
  // El control compuesto cubre los datos de ambos renglones, no el nombre.
  const composite =
    line1.slice(5, 30) + head.slice(0, 7) + head.slice(8, 15) + head.slice(18, 29);
  const line2 = `${head}${checkDigit(composite)}`;

  const line3 = pad("RIVERA<SOTO<<SOFIA", 30);
  return [line1, line2, line3];
}

export class MockOCRProvider implements OCRProvider {
  readonly name = "mock";

  async extractIdentityData(image: File | Blob): Promise<OCRResult> {
    void image;
    // Latencia parecida a la del motor real, para ver la pantalla de progreso.
    await new Promise((resolve) => setTimeout(resolve, 900));

    const lines = buildSampleMrz();
    const mrz = parseTd1(lines)!;
    const rawText = [
      "INSTITUTO NACIONAL ELECTORAL",
      "CREDENCIAL PARA VOTAR",
      ...lines,
    ].join("\n");

    return {
      fullName: mrz.fullName,
      documentNumber: mrz.documentNumber,
      birthDate: mrz.birthDate,
      expiryDate: mrz.expiryDate,
      curp: mrz.curp,
      rawText,
      confidence: mrz.verified ? 100 : mrz.confidence,
      fields: [
        { name: "fullName", value: mrz.fullName, confidence: 100 },
        {
          name: "documentNumber",
          value: mrz.documentNumber,
          confidence: 100,
        },
      ],
      mrz,
      expired: isExpired(mrz),
    };
  }
}
