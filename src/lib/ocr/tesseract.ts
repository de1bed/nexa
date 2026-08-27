import type { OCRProvider,OCRResult } from "./types";
export class TesseractOCRProvider implements OCRProvider { async extractIdentityData(image:File|Buffer):Promise<OCRResult>{const {recognize}=await import("tesseract.js");const result=await recognize(image as File,"spa");return {rawText:result.data.text,confidence:result.data.confidence,fields:[]};} }
