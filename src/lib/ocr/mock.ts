import type { OCRProvider, OCRResult } from "./types";
export class MockOCRProvider implements OCRProvider {
  async extractIdentityData(image: File | Buffer): Promise<OCRResult> {
    void image;
    await new Promise((r) => setTimeout(r, 450));
    return {
      fullName: "Sofía Rivera",
      documentNumber: "IDMX-4829",
      birthDate: "1992-04-18",
      rawText: "INSTITUTO NACIONAL ELECTORAL SOFIA RIVERA IDMX4829",
      confidence: 78,
      fields: [
        { name: "fullName", value: "Sofía Rivera", confidence: 94 },
        { name: "documentNumber", value: "IDMX-4829", confidence: 62 },
      ],
    };
  }
}
