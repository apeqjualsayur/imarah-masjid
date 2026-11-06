import { expect, test } from "@playwright/test";

test("shows the right navigation for the screen width", async ({ page, isMobile }) => {
  await page.goto("/");

  const nav = page.getByRole("navigation", { name: "Navigasi utama" });
  await expect(nav.getByRole("link", { name: "Kewangan" })).toBeVisible();
  await expect(nav.getByRole("link", { name: isMobile ? "Lagi" : "Tetapan" })).toBeVisible();
  await expect(nav.getByRole("link", { name: "Utama" })).toHaveAttribute("aria-current", "page");
});

test("switches between Bahasa Malaysia and English", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Utama" })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "ms");

  await page.getByRole("button", { name: "English" }).click();
  await expect(page.getByRole("heading", { name: "Home" })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");

  await page.reload();
  await expect(page.getByRole("heading", { name: "Home" })).toBeVisible();
});
