import { describe, expect, it } from "vitest";
import {
  escapeHtml,
  maskDocument,
  maskEmail,
  randomToken,
  safeCsvCell,
  safeInternalPath,
  sha256,
} from "../security";

describe("tokens", () => {
  it("hashea sin conservar el texto plano", async () => {
    const hash = await sha256("secreto");
    expect(hash).not.toContain("secreto");
    expect(hash).toHaveLength(64);
  });

  it("coincide con el hash conocido de SHA-256", async () => {
    // Mismo valor que produce public.token_hash() en PostgreSQL.
    await expect(sha256("abc")).resolves.toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });

  it("genera tokens opacos seguros para URL", () => {
    const token = randomToken(32);
    expect(token).not.toMatch(/[+/=]/);
    expect(token.length).toBeGreaterThan(32);
    expect(randomToken(32)).not.toBe(token);
  });
});

describe("minimización de datos", () => {
  it("enmascara la identificación dejando cuatro dígitos", () => {
    expect(maskDocument("ABC123456")).toBe("•••• 3456");
    expect(maskDocument("12")).toBe("••••");
  });

  it("enmascara el correo conservando el dominio", () => {
    expect(maskEmail("mateo@novalogistics.com")).toBe("m•••@novalogistics.com");
  });
});

describe("exportación y plantillas", () => {
  it("neutraliza fórmulas en el CSV", () => {
    expect(safeCsvCell("=cmd|' /c calc'!A1")).toContain("'=cmd");
    expect(safeCsvCell('texto "citado"')).toBe('"texto ""citado"""');
  });

  it("escapa el HTML de los correos", () => {
    expect(escapeHtml('<img src=x onerror="alert(1)">')).not.toContain("<img");
  });
});

describe("redirecciones", () => {
  it("acepta solo rutas internas", () => {
    expect(safeInternalPath("/app/dashboard", "/app")).toBe("/app/dashboard");
  });

  it("bloquea redirecciones abiertas", () => {
    expect(safeInternalPath("//evil.com", "/app")).toBe("/app");
    expect(safeInternalPath("https://evil.com", "/app")).toBe("/app");
    expect(safeInternalPath("/\\evil.com", "/app")).toBe("/app");
    expect(safeInternalPath(null, "/app")).toBe("/app");
  });
});
