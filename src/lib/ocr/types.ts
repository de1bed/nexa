import type { MrzResult } from "./mrz";

export type OCRField = {
  name:
    | "fullName"
    | "documentNumber"
    | "birthDate"
    | "expiryDate"
    | "curp"
    | "address";
  value: string;
  confidence: number;
};

export type OCRResult = {
  fullName?: string;
  documentNumber?: string;
  birthDate?: string;
  expiryDate?: string;
  curp?: string;
  address?: string;
  rawText: string;
  /** 0–100. Con MRZ verificado es la proporción de dígitos de control correctos. */
  confidence: number;
  fields: OCRField[];
  /**
   * Presente cuando se leyó la banda legible por máquina del reverso.
   * `mrz.verified` indica que **todos** los dígitos de control cuadraron: en ese
   * caso los datos no son una conjetura del OCR, sino una lectura comprobada.
   */
  mrz?: MrzResult;
  /** `true` si la credencial ya venció según su propia banda. */
  expired?: boolean;
};

export interface OCRProvider {
  readonly name: string;
  extractIdentityData(image: File | Blob): Promise<OCRResult>;
}

export const LOW_CONFIDENCE = 70;

/**
 * El OCR extrae texto: no valida la autenticidad del documento ni identifica
 * personas. Todo campo extraído es editable por el visitante antes de guardarse.
 */
export const OCR_DISCLAIMER =
  "La lectura extrae texto de la imagen. No verifica la autenticidad del documento ni realiza reconocimiento facial.";
