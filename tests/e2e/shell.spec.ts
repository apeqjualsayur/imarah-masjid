import { expect, test } from "@playwright/test";
import { seedEmail } from "../../scripts/seed-data";
import { mainNav, signIn } from "./helpers";

test.beforeEach(async ({ page }) => {
  await signIn(page, seedEmail("a", "pengerusi"));
});

test("shows the right navigation for the screen width", async ({ page, isMobile }) => {
  await page.goto("/");

  const nav = mainNav(page);
  await expect(nav.getByRole("link", { name: "Kewangan" })).toBeVisible();
  await expect(nav.getByRole("link", { name: isMobile ? "Lagi" : "Tetapan" })).toBeVisible();
  await expect(nav.getByRole("link", { name: "Utama" })).toHaveAttribute("aria-current", "page");
});

test("switches between Bahasa Malaysia and English", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Ringkasan kewangan" })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "ms");

  await page.getByRole("button", { name: "English" }).click();
  await expect(page.getByRole("heading", { name: "Finance summary" })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");

  await page.reload();
  await expect(page.getByRole("heading", { name: "Finance summary" })).toBeVisible();
});
