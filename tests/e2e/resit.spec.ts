import { expect, test } from "@playwright/test";
import { OPEN_DATE, seedEmail } from "../../scripts/seed-data";

// The seed and the database tests leave receipts in this month.
const RECEIPT_MONTH = OPEN_DATE.slice(0, 7);
import { signIn } from "./helpers";

test.describe.configure({ mode: "serial" });

test("Bendahari records a receipt, downloads the PDF and shares a link that opens signed out", async ({ page, browser, isMobile }) => {
  test.skip(isMobile, "one full run is enough");
  test.setTimeout(120_000);
  const donor = `Penderma ${crypto.randomUUID().slice(0, 6)}`;

  await signIn(page, seedEmail("a", "bendahari"));
  await page.goto("/kewangan/baru");
  await page.getByRole("radio", { name: /^Terima/ }).check();
  await page.getByRole("textbox", { name: /^Jumlah/ }).fill("120.50");
  await page.getByRole("combobox", { name: "Dana", exact: true }).selectOption({ label: "Tabung Am" });
  await page.getByRole("combobox", { name: "Kategori", exact: true }).selectOption({ label: "Derma" });
  await page.getByRole("textbox", { name: /^Daripada/ }).fill(donor);
  await page.getByRole("button", { name: "Simpan rekod" }).click();
  await expect(page.getByText("Rekod disimpan.")).toBeVisible();

  // From the entry to its receipt.
  await page.getByRole("link", { name: "Lihat rekod", exact: true }).click();
  await page.getByRole("link", { name: "Lihat resit" }).click();
  const preview = page.getByTestId("resit-pratonton");
  await expect(preview).toContainText(donor);
  await expect(preview).toContainText("RM 120.50");
  await expect(preview).toContainText("Seratus dua puluh ringgit dan lima puluh sen sahaja");
  const number = (await page.getByRole("heading", { level: 1 }).textContent())!.trim();
  expect(number).toMatch(/^RC-\d{4}-\d{4,}$/);

  // Download.
  const download = page.waitForEvent("download");
  await page.getByRole("link", { name: "Muat turun PDF" }).click();
  const file = await download;
  expect(file.suggestedFilename()).toBe(`resit-${number}.pdf`);

  // The WhatsApp button carries a short message and a signed link.
  const href = (await page.getByRole("link", { name: "Kongsi ke WhatsApp" }).getAttribute("href"))!;
  expect(href).toMatch(/^https:\/\/wa\.me\/\?text=/);
  const message = decodeURIComponent(href.split("text=")[1]);
  expect(message).toContain(number);
  const link = message.match(/https?:\/\/\S+\/r\/\S+/)![0];

  // Opened by a donor with no account.
  const donorContext = await browser.newContext();
  const response = await donorContext.request.get(link);
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toBe("application/pdf");
  const body = await response.body();
  expect(body.subarray(0, 5).toString()).toBe("%PDF-");
  // Masjid A's seeded logo is an SVG: it is drawn into the PDF as an image.
  expect(body.includes(Buffer.from("/Subtype /Image"))).toBe(true);

  // A changed link is refused with a plain page.
  const tampered = await donorContext.request.get(link.slice(0, -2) + (link.endsWith("AA") ? "BB" : "AA"));
  expect(tampered.status()).toBe(404);
  expect(await tampered.text()).toContain("Pautan resit tidak sah");
  await donorContext.close();

  // The receipt is in the list, found by its number.
  await page.goto(`/kewangan/resit?cari=${number.split("-")[2]}`);
  await expect(page.getByTestId("resit-baris").filter({ hasText: number })).toContainText("RM 120.50");
});

test("AJK can view receipts but not share them; the Imam cannot open them", async ({ page, isMobile }) => {
  test.skip(isMobile, "one full run is enough");
  await signIn(page, seedEmail("a", "ajk"));
  await page.goto(`/kewangan/resit?bulan=${RECEIPT_MONTH}`);
  await expect(page.getByRole("heading", { name: "Resit", level: 1 })).toBeVisible();
  const first = page.getByTestId("resit-baris").first();
  await first.click();
  await expect(page.getByRole("link", { name: "Muat turun PDF" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Kongsi ke WhatsApp" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Hantar emel" })).toHaveCount(0);

  await page.context().clearCookies();
  await signIn(page, seedEmail("a", "imam"));
  await page.goto("/kewangan/resit");
  await expect(page).toHaveURL(/tiada-akses/);
});

test("receipts list and a receipt fit on a phone", async ({ page, isMobile }) => {
  test.skip(!isMobile, "phone only");
  await signIn(page, seedEmail("a", "bendahari"));
  await page.goto("/kewangan");
  await page.getByRole("link", { name: "Resit", exact: true }).click();
  await expect(page).toHaveURL(/\/kewangan\/resit/);
  await page.goto(`/kewangan/resit?bulan=${RECEIPT_MONTH}`);
  await page.getByTestId("resit-baris").first().click();
  await expect(page.getByTestId("resit-pratonton")).toBeVisible();
  await expect(page.getByRole("link", { name: "Kongsi ke WhatsApp" })).toBeVisible();
  const width = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(width).toBeLessThanOrEqual(page.viewportSize()!.width);
});
