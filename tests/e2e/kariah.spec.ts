import { expect, test } from "@playwright/test";
import { seedEmail } from "../../scripts/seed-data";
import { mainNav, signIn } from "./helpers";

const randomMobile = () => `01${Math.floor(10_000_000 + Math.random() * 89_999_999)}`;

test.describe.configure({ mode: "serial" });

test("Setiausaha adds a household with a member, edits it, and the Pengerusi sees the history", async ({ browser, isMobile }) => {
  test.skip(isMobile, "one full run is enough");
  test.setTimeout(120_000);
  const name = `Ujian ${crypto.randomUUID().slice(0, 8)} bin Contoh`;

  const setiausaha = await (await browser.newContext()).newPage();
  await signIn(setiausaha, seedEmail("a", "setiausaha"));
  await mainNav(setiausaha).getByRole("link", { name: "Kariah" }).click();
  await setiausaha.getByRole("link", { name: "Tambah isi rumah" }).click();

  await setiausaha.getByLabel("Nama ketua keluarga").fill(name);
  await setiausaha.getByLabel("Alamat").fill("9 Jalan Ujian");
  await setiausaha.getByLabel("Telefon").fill("+60 12-555 0101");
  await setiausaha.getByLabel("Setuju menerima mesej WhatsApp").check();
  await setiausaha.getByLabel("Setuju dengan notis privasi (PDPA)").check();
  await setiausaha.getByRole("button", { name: "Simpan" }).click();

  await expect(setiausaha.getByRole("heading", { name })).toBeVisible();
  await expect(setiausaha.getByText("012-555 0101")).toBeVisible();
  await expect(setiausaha.getByRole("link", { name: "WhatsApp" })).toHaveAttribute("href", "https://wa.me/60125550101");

  // A member, with a full IC pasted: only the last 4 digits remain.
  await setiausaha.getByRole("link", { name: "Tambah ahli" }).click();
  await setiausaha.getByLabel("Nama").fill("Aisyah binti Ujian");
  await setiausaha.getByLabel("Hubungan dengan ketua").selectOption("anak");
  await setiausaha.getByLabel("Tarikh lahir").fill("2010-05-17");
  await setiausaha.getByLabel(/No. KP/).fill("100517-14-5678");
  await expect(setiausaha.getByLabel(/No. KP/)).toHaveValue("5678");
  await expect(setiausaha.getByText("Nombor penuh telah dipotong")).toBeVisible();
  await setiausaha.getByRole("button", { name: "Simpan" }).click();
  await expect(setiausaha.getByText("Aisyah binti Ujian")).toBeVisible();
  await expect(setiausaha.getByText(/Anak · \d+ tahun · KP: ••••5678/)).toBeVisible();
  const url = setiausaha.url();

  // Edit: new address and WhatsApp withdrawn.
  await setiausaha.getByRole("link", { name: "Ubah", exact: true }).first().click();
  await setiausaha.getByLabel("Alamat").fill("10 Jalan Ujian Baharu");
  await setiausaha.getByLabel("Setuju menerima mesej WhatsApp").uncheck();
  await setiausaha.getByRole("button", { name: "Simpan" }).click();
  await expect(setiausaha.getByText("10 Jalan Ujian Baharu")).toBeVisible();
  // Setiausaha cannot see the history (audit view is Pengerusi and Bendahari only).
  await expect(setiausaha.getByRole("heading", { name: "Sejarah perubahan" })).toHaveCount(0);

  // The Pengerusi sees who changed what and when, without personal values.
  const pengerusi = await (await browser.newContext()).newPage();
  await signIn(pengerusi, seedEmail("a", "pengerusi"));
  await pengerusi.goto(url);
  const history = pengerusi.getByTestId("history");
  await expect(history.getByText("Isi rumah diubah").first()).toBeVisible();
  await expect(history.getByText("Setiausaha Contoh A").first()).toBeVisible();
  await expect(history.getByText("Alamat: diubah")).toBeVisible();
  await expect(history.getByText("WhatsApp: ✓ → ✗")).toBeVisible();
  await expect(history.getByText("Ahli ditambah")).toBeVisible();
  await expect(history).not.toContainText("10 Jalan Ujian Baharu");
  // The Pengerusi views but does not edit.
  await expect(pengerusi.getByRole("link", { name: "Ubah", exact: true })).toHaveCount(0);

  // Masjid B cannot open masjid A's household.
  const other = await (await browser.newContext()).newPage();
  await signIn(other, seedEmail("b", "pengerusi"));
  const response = await other.goto(url);
  expect(response?.status()).toBe(404);
});

test("Setiausaha imports a CSV: errors are shown, only valid rows go in", async ({ page, isMobile }) => {
  test.skip(isMobile, "one full run is enough");
  const tag = crypto.randomUUID().slice(0, 6);
  const csv = [
    "nama_ketua,alamat,telefon,whatsapp,pdpa",
    `Import ${tag} Satu,1 Jalan Import,${randomMobile()},ya,ya`,
    `Import ${tag} Dua,2 Jalan Import,${randomMobile()},tidak,ya`,
    `,3 Jalan Import,${randomMobile()},tidak,ya`,
    `Import ${tag} Empat,4 Jalan Import,1.23E+09,tidak,ya`,
    `Import ${tag} Satu,1 Jalan Import,,tidak,ya`,
  ].join("\r\n");

  await signIn(page, seedEmail("a", "setiausaha"));
  await page.goto("/kariah/import");
  await page.getByLabel("Fail CSV").setInputFiles({ name: "kariah.csv", mimeType: "text/csv", buffer: Buffer.from(`﻿${csv}`) });
  await page.getByRole("button", { name: "Semak fail" }).click();

  await expect(page.getByTestId("import-counts")).toHaveText(
    "2 baris sedia untuk diimport, 3 baris ada ralat dan akan dilangkau.",
  );
  await expect(page.getByText("Nama ketua kosong")).toBeVisible();
  await expect(page.getByText(/telah dirosakkan oleh Excel/)).toBeVisible();
  await expect(page.getByText("Berulang dalam fail ini")).toBeVisible();

  await page.getByRole("button", { name: "Import 2 isi rumah" }).click();
  await expect(page.getByText("2 isi rumah diimport, 3 dilangkau.")).toBeVisible();

  await page.getByRole("link", { name: "Lihat senarai kariah" }).click();
  await page.getByRole("searchbox").or(page.getByPlaceholder("Cari nama, telefon atau alamat")).fill(`Import ${tag}`);
  await page.getByRole("button", { name: "Cari" }).click();
  await expect(page.getByRole("link", { name: new RegExp(`Import ${tag}`) })).toHaveCount(2);
});

test("the template downloads", async ({ page, isMobile }) => {
  test.skip(isMobile, "one run is enough");
  await signIn(page, seedEmail("a", "setiausaha"));
  const response = await page.request.get("/kariah/import/templat");
  expect(response.headers()["content-type"]).toContain("text/csv");
  expect(await response.text()).toContain("nama_ketua,alamat,telefon,whatsapp,pdpa");
});

test("Bendahari views the kariah but cannot change it", async ({ page }) => {
  await signIn(page, seedEmail("a", "bendahari"));
  await page.goto("/kariah");
  await expect(page.getByRole("heading", { name: "Kariah" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Tambah isi rumah" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Import CSV" })).toHaveCount(0);

  await page.goto("/kariah/import");
  await expect(page.getByRole("heading", { name: "Tiada akses" })).toBeVisible();
  await page.goto("/kariah/baru");
  await expect(page.getByRole("heading", { name: "Tiada akses" })).toBeVisible();
});

test("Imam has no access to the kariah", async ({ page }) => {
  await signIn(page, seedEmail("a", "imam"));
  await page.goto("/kariah");
  await expect(page.getByRole("heading", { name: "Tiada akses" })).toBeVisible();
});
