import { expect, test } from "@playwright/test";

test("el anfitrión tiene su propio portal y no entra a administración", async ({
  page,
}) => {
  await page.goto("/login");
  await page.getByRole("button", { name: /Anfitrión/ }).click();
  await expect(page).toHaveURL(/\/app\/host$/);
  await expect(page.getByRole("heading", { name: /Hola,/ })).toBeVisible();

  // Las vistas de administración lo devuelven a su propio resumen, sin bucles.
  await page.goto("/app/reports");
  await expect(page).toHaveURL(/\/app\/host$/);
  await page.goto("/app/dashboard");
  await expect(page).toHaveURL(/\/app\/host$/);
  await page.goto("/app/team");
  await expect(page).toHaveURL(/\/app\/host$/);

  await page.goto("/app/visits");
  await expect(page.getByRole("heading", { name: "Mis visitas" })).toBeVisible();
});

test("el guardia solo opera la caseta", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("button", { name: /Guardia/ }).click();
  await expect(page).toHaveURL(/\/guard\/scan$/);

  await page.goto("/app/dashboard");
  await expect(page).toHaveURL(/\/guard\/scan$/);

  await page.goto("/guard/inside");
  await expect(
    page.getByRole("heading", { name: /Personas dentro/ }),
  ).toBeVisible();
});

test("la administración llega a toda la operación", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("button", { name: /Administración/ }).click();
  await expect(page).toHaveURL(/\/app\/dashboard$/);

  for (const [path, heading] of [
    ["/app/visits", "Visitas"],
    ["/app/people-on-site", "Personas dentro"],
    ["/app/reports", "Reportes"],
    ["/app/team", "Equipo"],
    ["/app/locations", "Ubicaciones"],
    ["/app/settings", "Configuración"],
  ] as const) {
    await page.goto(path);
    await expect(page.getByRole("heading", { name: heading })).toBeVisible();
  }
});

test("el visitante abre el preregistro público sin cuenta", async ({ page }) => {
  await page.goto("/demo/visitor");
  await expect(
    page.getByRole("heading", { name: /Prepara tu visita/ }),
  ).toBeVisible();

  await page.getByRole("link", { name: /Probar el preregistro/ }).click();
  await expect(page).toHaveURL(/\/visit\/nexa-demo-invitation-2026$/);
  await expect(
    page.getByRole("heading", { name: /te está esperando/ }),
  ).toBeVisible();
});

test("un enlace inválido no revela información", async ({ page }) => {
  await page.goto("/visit/token-que-no-existe");
  await expect(
    page.getByRole("heading", { name: "Enlace no disponible" }),
  ).toBeVisible();

  await page.goto("/pass/pase-que-no-existe");
  await expect(
    page.getByRole("heading", { name: "Pase no disponible" }),
  ).toBeVisible();
});

test("el anfitrión puede invitar sin conocer los datos del visitante", async ({
  page,
}) => {
  await page.goto("/login");
  await page.getByRole("button", { name: /Anfitrión/ }).click();
  await expect(page).toHaveURL(/\/app\/host$/);

  await page.goto("/app/visits/new");
  await page.getByRole("button", { name: "Que llene todo" }).click();
  await page.getByRole("button", { name: /Crear invitación/ }).click();
  await expect(
    page.getByRole("heading", { name: "Invitación lista" }),
  ).toBeVisible();

  const link = await page.getByLabel("Enlace de invitación").inputValue();
  await page.goto(link);
  await page.getByRole("button", { name: /Comenzar mi registro/ }).click();

  await expect(
    page.getByText("Necesitamos lo mínimo para identificarte en recepción."),
  ).toBeVisible();
  await expect(page.getByLabel("Nombre completo")).toHaveValue("");
  await expect(page.getByLabel("Correo")).toHaveValue("");
});
