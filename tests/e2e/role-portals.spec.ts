import { expect, test } from "@playwright/test";

test("el anfitrión entra a un portal propio y solo consulta sus visitas", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("button", { name: /Anfitrión Mis visitas/ }).click();
  await page.getByRole("button", { name: /Entrar como Anfitrión/ }).click();
  await expect(page).toHaveURL(/\/app\/host$/);
  await expect(page.getByRole("heading", { name: "Hola, Mateo" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Mi resumen" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Mis visitas" })).toBeVisible();

  await page.goto("/app/reports");
  await expect(page).toHaveURL(/\/app\/host$/);
  await page.goto("/app/visits");
  await expect(page.getByRole("heading", { name: "Mis visitas" })).toBeVisible();
  await expect(page.getByText("Valeria Cruz", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Mateo García", { exact: true }).first()).toBeVisible();
});

test("el visitante encuentra y abre el preregistro público sin cuenta", async ({ page }) => {
  await page.goto("/demo/visitor");
  await expect(page.getByRole("heading", { name: /Prepara tu visita/ })).toBeVisible();
  await expect(page.getByText("Experiencia sin cuenta ni aplicación")).toBeVisible();
  await page.getByRole("link", { name: /Completar preregistro demo/ }).click();
  await expect(page).toHaveURL(/\/visit\/nexa-demo-invitation-2026$/);
  await expect(page.getByRole("heading", { name: /te está invitando/ })).toBeVisible();
});

test("el anfitrión puede compartir un enlace sin conocer los datos del visitante", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("button", { name: /Anfitrión Mis visitas/ }).click();
  await page.getByRole("button", { name: /Entrar como Anfitrión/ }).click();
  await expect(page).toHaveURL(/\/app\/host$/);
  await page.goto("/app/visits/new");
  await page.getByRole("button", { name: "Dejar que el visitante llene todo" }).click();
  await page.getByRole("button", { name: /Crear invitación/ }).click();
  await expect(page.getByRole("heading", { name: "Invitación creada" })).toBeVisible();
  const link = await page.getByLabel("Enlace de invitación").inputValue();
  await page.goto(link);
  await expect(page.getByRole("heading", { name: /Mateo García te está invitando/ })).toBeVisible();
  await page.getByRole("button", { name: /Comenzar/ }).click();
  await expect(page.getByText("Tu anfitrión dejó estos campos para que tú los completes.")).toBeVisible();
  await expect(page.getByLabel("Nombre completo", { exact: true })).toHaveValue("");
  await expect(page.getByLabel("Correo", { exact: true })).toHaveValue("");
  await expect(page.getByLabel("Empresa", { exact: true })).toHaveValue("");
});
