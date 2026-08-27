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
  const menu = page.getByLabel("Abrir menú");
  if (await menu.isVisible()) await menu.click();
  await page.getByRole("link", { name: "Mis visitas" }).click();
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
  await expect(page.getByRole("heading", { name: "Prepara tu visita" })).toBeVisible();
});
