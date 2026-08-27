export async function sha256(value:string){const bytes=new TextEncoder().encode(value);const hash=await crypto.subtle.digest("SHA-256",bytes);return [...new Uint8Array(hash)].map(b=>b.toString(16).padStart(2,"0")).join("");}
export function randomToken(bytes=32){const data=new Uint8Array(bytes);crypto.getRandomValues(data);return btoa(String.fromCharCode(...data)).replaceAll("+","-").replaceAll("/","_").replaceAll("=","");}
export function maskDocument(value:string){const clean=value.replace(/\s/g,"");return clean.length<=4?"••••":`•••• ${clean.slice(-4)}`;}
export function safeCsvCell(value:unknown){const s=String(value??"");const guarded=/^[=+\-@]/.test(s)?`'${s}`:s;return `"${guarded.replaceAll('"','""')}"`;}
