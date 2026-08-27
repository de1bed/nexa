export type OCRResult={fullName?:string;documentNumber?:string;birthDate?:string;address?:string;rawText:string;confidence:number;fields:Array<{name:string;value:string;confidence:number}>};
export interface OCRProvider { extractIdentityData(image:File|Buffer):Promise<OCRResult> }
