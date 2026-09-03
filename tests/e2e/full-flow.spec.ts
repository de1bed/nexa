import { expect, test } from "@playwright/test";

/**
 * Recorrido completo en modo vitrina:
 * anfitrión invita → visitante se registra → guardia valida entrada y salida →
 * administración ve el resultado en su operación.
 */
test("anfitrión → visitante → guardia → administración", async ({ page }) => {
  const visitorName = `Visitante E2E ${test.info().project.name}`;

  // --- Anfitrión crea la invitación -------------------------------------
  await page.goto("/login");
  await expect(
    page.getByRole("heading", { name: "Elige un perfil" }),
  ).toBeVisible();
  await page.getByRole("button", { name: /Anfitrión/ }).click();
  await expect(page).toHaveURL(/\/app\/host$/);

  await page.goto("/app/visits/new");
  await page.getByLabel("Nombre completo").fill(visitorName);
  await page.getByLabel("Correo", { exact: false }).first().fill("e2e@example.test");
  await page.getByLabel("Empresa").fill("QA Labs");
  await page.getByRole("button", { name: /Crear invitación/ }).click();

  await expect(
    page.getByRole("heading", { name: "Invitación lista" }),
  ).toBeVisible();
  const invitationUrl = await page
    .getByLabel("Enlace de invitación")
    .inputValue();
  expect(invitationUrl).toContain("/visit/");

  // --- Visitante completa su preregistro --------------------------------
  await page.goto(invitationUrl);
  await expect(page.getByRole("heading", { name: /te está esperando/ })).toBeVisible();
  await page.getByRole("button", { name: /Comenzar mi registro/ }).click();

  await page.getByLabel("Nombre completo").fill(visitorName);
  await page.getByLabel("Correo").fill("e2e@example.test");
  await page.getByLabel("Teléfono").fill("5512345678");
  await page.getByLabel("Empresa").fill("QA Labs");
  await page.getByRole("button", { name: /^Continuar/ }).click();

  // La credencial se captura por ambas caras: el reverso es el que se lee.
  await expect(
    page.getByRole("heading", { name: "Tu identificación" }),
  ).toBeVisible();

  for (const side of ["Frente", "Reverso"]) {
    await page.getByRole("button", { name: new RegExp(`^${side}`) }).click();
    await page.locator('input[type="file"]').setInputFiles({
      name: `identificacion-${side.toLowerCase()}.jpg`,
      mimeType: "image/jpeg",
      buffer: Buffer.from(`imagen-de-prueba-${side}`),
    });
  }

  await page.getByRole("button", { name: /Leer mi identificación/ }).click();

  await expect(
    page.getByRole("heading", { name: "Revisa lo que leímos" }),
  ).toBeVisible({ timeout: 15000 });
  // El proveedor reproducible entrega una banda MRZ con dígitos de control
  // correctos, así que la interfaz debe mostrarla como verificada.
  await expect(page.getByText("Lectura verificada")).toBeVisible();
  await page.getByLabel("Nombre completo").fill(visitorName);
  await page.getByRole("button", { name: /^Continuar/ }).click();

  await expect(
    page.getByRole("heading", { name: "Detalles finales" }),
  ).toBeVisible();
  await page.getByRole("button", { name: /^Continuar/ }).click();

  await expect(page.getByRole("heading", { name: "Privacidad" })).toBeVisible();
  await page.getByText(/He leído el aviso y acepto/).click();
  await page.getByRole("button", { name: /Aceptar y generar pase/ }).click();

  await expect(page.getByRole("heading", { name: "¡Todo listo!" })).toBeVisible();
  await expect(page.getByAltText("Código QR de acceso")).toBeVisible();

  const qrToken = await page.evaluate((name) => {
    const raw = localStorage.getItem("nexa-visit-showcase-v3");
    if (!raw) throw new Error("No se persistió el estado de la vitrina");
    const state = JSON.parse(raw) as {
      visits: Array<{ visitorName: string; qrToken?: string }>;
    };
    const token = state.visits.find(
      (visit) => visit.visitorName === name,
    )?.qrToken;
    if (!token) throw new Error("No se generó el pase de la visita");
    return token;
  }, visitorName);

  // --- Guardia valida la entrada ----------------------------------------
  await page.goto("/login");
  await page.getByRole("button", { name: /Guardia/ }).click();
  await expect(page).toHaveURL(/\/guard\/scan$/);

  await page.getByLabel("Código del pase").fill(qrToken);
  await page.getByRole("button", { name: "Validar", exact: true }).click();
  await expect(page.getByRole("heading", { name: visitorName })).toBeVisible();

  const override = page.getByText(/Autorizo explícitamente esta entrada/);
  if (await override.isVisible()) await override.click();
  await page.getByRole("button", { name: /Autorizar entrada/ }).click();
  await expect(
    page.getByRole("heading", { name: "Entrada autorizada" }),
  ).toBeVisible();

  // --- El visitante aparece dentro, con cronómetro ----------------------
  await page.getByRole("button", { name: /Escanear siguiente/ }).click();
  await page.goto("/guard/inside");
  await expect(
    page.getByText(visitorName).filter({ visible: true }).first(),
  ).toBeVisible();

  // --- Guardia registra la salida ---------------------------------------
  await page.goto("/guard/scan");
  await page.getByLabel("Código del pase").fill(qrToken);
  await page.getByRole("button", { name: "Validar", exact: true }).click();
  await page.getByRole("button", { name: /Registrar salida/ }).click();
  await expect(
    page.getByRole("heading", { name: "Salida registrada" }),
  ).toBeVisible();

  // --- Administración ve el registro completo ---------------------------
  await page.goto("/login");
  await page.getByRole("button", { name: /Administración/ }).click();
  await expect(page).toHaveURL(/\/app\/dashboard$/);

  await page.goto("/app/visits");
  await page.getByLabel("Buscar visitas").fill(visitorName);
  // La lista es tarjetas en móvil y tabla en escritorio: se valida la visible.
  await expect(
    page.getByText(visitorName).filter({ visible: true }).first(),
  ).toBeVisible();
  await expect(
    page.getByText("Salida registrada").filter({ visible: true }).first(),
  ).toBeVisible();

  await page.goto("/app/reports");
  await expect(page.getByRole("heading", { name: "Reportes" })).toBeVisible();
});
