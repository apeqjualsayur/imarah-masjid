import { expect, test } from "@playwright/test";
import { seedEmail } from "../../scripts/seed-data";
import { mainNav, signIn } from "./helpers";

test.describe.configure({ mode: "serial" });

const PDF = { name: "resit.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4\n%ujian\n") };

test("Bendahari records a receipt, cancels it with a reason and enters the correct one", async ({ page, isMobile }) => {
  test.skip(isMobile, "one full run is enough");
  test.setTimeout(120_000);
  const tag = `UJI-${crypto.randomUUID().slice(0, 6)}`;

  await signIn(page, seedEmail("a", "bendahari"));
  await mainNav(page).getByRole("link", { name: "Kewangan" }).click();
  await page.getByRole("link", { name: "Rekod baharu" }).click();

  // A refused amount keeps what was typed.
  await page.getByRole("radio", { name: /^Terima/ }).check();
  await page.getByRole("textbox", { name: /^Jumlah/ }).fill("12.345");
  await page.getByRole("combobox", { name: "Dana", exact: true }).selectOption({ label: "Tabung Am" });
  await page.getByRole("combobox", { name: "Kategori", exact: true }).selectOption({ label: "Derma" });
  await page.getByLabel("Rujukan").fill(tag);
  await page.getByRole("button", { name: "Simpan rekod" }).click();
  await expect(page.getByText("Jumlah tidak sah")).toBeVisible();
  await expect(page.getByLabel("Rujukan")).toHaveValue(tag);

  await page.getByRole("textbox", { name: /^Jumlah/ }).fill("1,234.5");
  await page.getByRole("combobox", { name: "Kategori", exact: true }).selectOption({ label: "Derma" });
  await page.getByRole("combobox", { name: "Kaedah" }).selectOption("duitnow");
  await page.getByLabel("Catatan").fill("Derma ujian");
  await page.getByLabel("Lampiran (pilihan)").setInputFiles(PDF);
  await page.getByRole("button", { name: "Simpan rekod" }).click();

  await expect(page).toHaveURL(/\/kewangan\?bulan=\d{4}-\d{2}&disimpan=/);
  await expect(page.getByText("Rekod disimpan.")).toBeVisible();
  const row = page.getByTestId("lejar-baris").filter({ hasText: tag });
  await expect(row).toContainText("+RM 1,234.50");
  await expect(row).toContainText("DuitNow");

  // The entry page shows the attachment and lets the Bendahari cancel it.
  await row.click();
  await expect(page.getByRole("link", { name: "Buka lampiran" })).toBeVisible();
  await page.getByLabel("Sebab pembatalan").fill(`Jumlah salah ${tag}`);
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Batalkan rekod" }).click();

  // The new-entry form opens filled in from the cancelled entry.
  await expect(page).toHaveURL(/\/kewangan\/baru\?dari=/);
  await expect(page.getByText("Rekod asal telah dibatalkan")).toBeVisible();
  await expect(page.getByRole("textbox", { name: /^Jumlah/ })).toHaveValue("1234.50");
  await expect(page.getByLabel("Rujukan")).toHaveValue(tag);
  await page.getByRole("textbox", { name: /^Jumlah/ }).fill("1,243.50");
  await page.getByRole("button", { name: "Simpan rekod" }).click();
  await expect(page.getByText("Rekod disimpan.")).toBeVisible();

  // The original stays, marked cancelled; its cancellation and the correct entry are there too.
  const rows = page.getByTestId("lejar-baris");
  // Three rows carry the tag: the original (its reference), the cancellation (its reason) and the correct entry.
  await expect(rows.filter({ hasText: tag })).toHaveCount(3);
  await expect(rows.filter({ hasText: tag }).filter({ hasText: "Dibatalkan" })).toContainText("+RM 1,234.50");
  await expect(rows.filter({ hasText: tag }).filter({ hasNotText: "Dibatalkan" }).filter({ hasNotText: "Pembatalan" })).toContainText(
    "+RM 1,243.50",
  );
  await expect(rows.filter({ hasText: `Jumlah salah ${tag}` })).toContainText("Pembatalan");
  await expect(rows.filter({ hasText: `Jumlah salah ${tag}` })).toContainText("−RM 1,234.50");

  // One fund selected: opening, running and closing balance appear.
  await page.getByRole("combobox", { name: "Dana", exact: true }).selectOption({ label: "Tabung Am" });
  await page.getByRole("button", { name: "Tapis" }).click();
  await expect(page.getByText("Baki awal bulan")).toBeVisible();
  await expect(page.getByText("Baki akhir bulan")).toBeVisible();

  // CSV export of the same list.
  const download = page.waitForEvent("download");
  await page.getByRole("link", { name: "Eksport CSV" }).click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/^lejar-\d{4}-\d{2}\.csv$/);
});

test("saving into a locked month gives a plain message and keeps the form", async ({ page, isMobile }) => {
  test.skip(isMobile, "one full run is enough");
  await signIn(page, seedEmail("a", "bendahari"));
  await page.goto("/kewangan/baru");
  await page.getByRole("radio", { name: /^Bayar/ }).check();
  await page.getByRole("textbox", { name: /^Jumlah/ }).fill("50");
  await page.getByLabel("Tarikh").fill("2026-09-15");
  await page.getByRole("combobox", { name: "Dana", exact: true }).selectOption({ label: "Tabung Am" });
  await page.getByRole("combobox", { name: "Kategori", exact: true }).selectOption({ label: "Gaji" });
  await page.getByRole("button", { name: "Simpan rekod" }).click();
  await expect(page.getByText("Bulan ini sudah dikunci")).toBeVisible();
  await expect(page.getByRole("textbox", { name: /^Jumlah/ })).toHaveValue("50");
});

test("only the Bendahari can record; the Pengerusi can cancel but not record", async ({ browser }) => {
  const ajk = await (await browser.newContext()).newPage();
  await signIn(ajk, seedEmail("a", "ajk"));
  await ajk.goto("/kewangan");
  await expect(ajk.getByRole("heading", { name: "Kewangan", exact: true })).toBeVisible();
  await expect(ajk.getByRole("link", { name: "Rekod baharu" })).toHaveCount(0);
  await ajk.goto("/kewangan/baru");
  await expect(ajk).toHaveURL(/\/tiada-akses$/);

  const pengerusi = await (await browser.newContext()).newPage();
  await signIn(pengerusi, seedEmail("a", "pengerusi"));
  await pengerusi.goto("/kewangan/baru");
  await expect(pengerusi).toHaveURL(/\/tiada-akses$/);
});

test("the Imam sees totals only", async ({ page }) => {
  await signIn(page, seedEmail("a", "imam"));
  await page.goto("/");
  await expect(page.getByText("Jumlah semua dana")).toBeVisible();
  await expect(page.getByTestId("jumlah-semua-dana")).toContainText("RM");
  await expect(page.getByTestId("kad-dana")).toHaveCount(0);
  await expect(page.getByText("Peranan anda melihat jumlah sahaja")).toBeVisible();
  await page.goto("/kewangan");
  await expect(page).toHaveURL(/\/tiada-akses$/);
});

test("the dashboard shows fund cards with restricted funds marked", async ({ page }) => {
  await signIn(page, seedEmail("a", "pengerusi"));
  await page.goto("/");
  const cards = page.getByTestId("kad-dana");
  await expect(cards.filter({ hasText: "Tabung Am" })).toBeVisible();
  await expect(cards.filter({ hasText: "Pembangunan" })).toContainText("Terhad");
  await expect(page.getByRole("heading", { name: "Lejar terkini" })).toBeVisible();
});

test("Pengerusi adds a fund and archives it", async ({ page, isMobile }) => {
  test.skip(isMobile, "one full run is enough");
  const name = `Dana E2E ${crypto.randomUUID().slice(0, 6)}`;
  await signIn(page, seedEmail("a", "pengerusi"));
  await page.goto("/tetapan");
  await page.getByRole("link", { name: /Dana & kategori/ }).click();
  await page.getByPlaceholder("Nama dana baharu").fill(name);
  await page.getByRole("button", { name: "Tambah dana" }).click();

  const fund = page.getByTestId("senarai-dana").getByRole("listitem").filter({ has: page.locator(`input[value="${name}"]`) });
  await expect(fund).toContainText("Baki RM 0.00");
  await fund.getByRole("button", { name: "Arkib" }).click();
  await expect(fund.getByRole("button", { name: "Aktifkan semula" })).toBeVisible();
});
