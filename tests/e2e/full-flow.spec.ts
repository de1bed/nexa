import { test, expect } from "@playwright/test";

test("recorrido anfitrión → visitante → guardia → reporte", async ({ page }) => {
  const visitorName = `Visitante E2E ${test.info().project.name}`;

  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Accede a tu espacio" })).toBeVisible();
  await page.getByRole("button", { name: /Iniciar sesión/ }).click();
  await expect(page).toHaveURL(/app\/dashboard/);
  await page.goto("/app/visits/new");
  await page.getByLabel("Nombre completo *").filter({ visible: true }).fill(visitorName);
  await page.getByLabel("Correo *").filter({ visible: true }).fill("e2e@example.test");
  await page.getByLabel("Empresa *").filter({ visible: true }).fill("QA Labs");
  await page.getByRole("button", { name: /Crear y enviar/ }).click();
  await expect(page.getByRole("heading", { name: "Invitación creada" })).toBeVisible();
  const link = await page.getByLabel("Enlace de invitación").inputValue();
  await page.goto(link);
  await page.getByRole("button", { name: /Comenzar/ }).click();
  await page.getByLabel("Nombre completo").fill(visitorName);
  await page.getByLabel("Correo").fill("e2e@example.test");
  await page.getByLabel("Teléfono").fill("6640000000");
  await page.getByLabel("Empresa").fill("QA Labs");
  await page.getByRole("button", { name: /^Continuar/ }).click();
  await page.locator('input[type="file"]').setInputFiles({
    name: "identificacion-e2e.jpg",
    mimeType: "image/jpeg",
    buffer: Buffer.from("imagen-de-prueba-ocr-mock"),
  });
  await expect(
    page.getByRole("heading", { name: "Revisa la extracción" }),
  ).toBeVisible();
  await page.getByLabel("Nombre completo").fill(visitorName);
  await page.getByRole("button", { name: /^Continuar/ }).click();
  await page.getByRole("button", { name: /^Continuar/ }).click();
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: /Aceptar y generar pase/ }).click();
  await expect(page.getByRole("heading", { name: "Tu pase está listo" })).toBeVisible();

  const qrToken = await page.evaluate((name) => {
    const raw = localStorage.getItem("nexa-visit-demo-v2");
    if (!raw) throw new Error("No se persistió el estado de demostración");
    const state = JSON.parse(raw) as {
      visits: Array<{ visitorName: string; qrToken?: string }>;
    };
    const token = state.visits.find((visit) => visit.visitorName === name)?.qrToken;
    if (!token) throw new Error("No se generó el token QR de la visita");
    return token;
  }, visitorName);

  await page.goto("/guard/scan");
  await page.getByLabel("Token del pase").fill(qrToken);
  await page.getByRole("button", { name: "Validar", exact: true }).click();
  await expect(page.getByRole("heading", { name: visitorName })).toBeVisible();
  const outsideWindow = page.getByLabel(/Autorizo explícitamente/);
  if (await outsideWindow.isVisible()) await outsideWindow.check();
  await page.getByRole("button", { name: /Validar entrada/ }).click();
  await expect(page.getByRole("heading", { name: "Entrada autorizada" })).toBeVisible();

  await page.getByRole("button", { name: /Continuar/ }).click();
  await page.getByLabel("Token del pase").fill(qrToken);
  await page.getByRole("button", { name: "Validar", exact: true }).click();
  await expect(page.getByRole("heading", { name: visitorName })).toBeVisible();
  await page.getByRole("button", { name: /Registrar salida/ }).click();
  await expect(page.getByRole("heading", { name: "Salida registrada" })).toBeVisible();

  await page.goto("/app/reports");
  await expect(page.getByRole("heading", { name: "Reportes" })).toBeVisible();
  await page.goto("/app/visits");
  await page.getByLabel("Buscar visitas").filter({ visible: true }).fill(visitorName);
  await expect(page.getByText(visitorName, { exact: true })).toBeVisible();
  await expect(
    page.getByRole("cell", { name: "Salida registrada" }),
  ).toBeVisible();
});
