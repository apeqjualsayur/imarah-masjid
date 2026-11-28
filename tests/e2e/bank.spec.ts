import { expect, test } from "@playwright/test";
import QRCode from "qrcode";
import { crc16 } from "../../lib/duitnow";
import { masjidId, seedEmail } from "../../scripts/seed-data";
import { admin, signIn } from "./helpers";

test.describe.configure({ mode: "serial" });

const MASJID_A = masjidId("a");
const tag = crypto.randomUUID().slice(0, 6);
// A month in the past nobody else uses, so it starts empty and can reach zero.
const month = `${2001 + Math.floor(Math.random() * 23)}-${`${1 + Math.floor(Math.random() * 12)}`.padStart(2, "0")}`;
const [year, mm] = month.split("-");
const day = (d: number) => `${`${d}`.padStart(2, "0")}/${mm}/${year}`;

// A fake statement with the account details above the header, like most banks.
const statement = Buffer.from(
  [
    "Penyata Akaun Ujian",
    "No. Akaun,XXXX-0000",
    "",
    `Tarikh,Butiran ${tag},Keluar,Masuk,Baki`,
    `${day(5)},DUITNOW ${tag},,"1,234.56",`,
    `${day(10)},BIL TNB ${tag},200.00,,`,
    `${day(12)},DEPOSIT TUNAI ${tag},,500.00,`,
    `${day(15)},DERMA ONLINE ${tag},,75.00,`,
  ].join("\r\n"),
);
const file = { name: `penyata-${tag}.csv`, mimeType: "text/csv", buffer: statement };

async function categoryId(name: string, type: string) {
  const { data } = await admin.from("categories").select("id").eq("masjid_id", MASJID_A).eq("name", name).eq("type", type).limit(1).single();
  return data!.id as string;
}

test.beforeAll(async () => {
  const { data: fund } = await admin.from("funds").select("id").eq("masjid_id", MASJID_A).eq("name", "Tabung Am").single();
  const base = { masjid_id: MASJID_A, fund_id: fund!.id, method: "bank_transfer" };
  const { error } = await admin.from("transactions").insert([
    { ...base, category_id: await categoryId("Derma", "income"), amount_sen: 123_456, direction: "in", date: `${month}-06`, note: `Derma ${tag}` },
    { ...base, category_id: await categoryId("Utiliti", "expense"), amount_sen: 20_000, direction: "out", date: `${month}-10`, note: `TNB ${tag}` },
  ]);
  if (error) throw new Error(error.message);
});

test("Bendahari imports a statement and reconciles the month to zero", async ({ page, isMobile }) => {
  test.skip(isMobile, "one full run is enough");
  test.setTimeout(180_000);
  await signIn(page, seedEmail("a", "bendahari"));

  // Import with a new bank's columns. The app guesses them from the header names.
  await page.goto("/kewangan/bank/import");
  await page.getByLabel("Fail CSV").setInputFiles(file);
  await expect(page.getByTestId("pilih-lajur")).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Lajur tarikh" })).toHaveValue("Tarikh");
  await expect(page.getByRole("combobox", { name: "Lajur debit (wang keluar)" })).toHaveValue("Keluar");
  await expect(page.getByRole("combobox", { name: "Lajur kredit (wang masuk)" })).toHaveValue("Masuk");
  await page.getByLabel("Nama bank").fill(`Bank Ujian ${tag}`);
  await page.getByRole("button", { name: "Semak" }).click();
  await expect(page.getByTestId("pratonton-ringkasan")).toHaveText("4 baris baharu, 0 sudah diimport, 0 dalam bulan dikunci.");
  await page.getByRole("button", { name: "Import 4 baris baharu" }).click();

  await expect(page).toHaveURL(new RegExp(`/kewangan/bank\\?bulan=${month}&import=4`));
  await expect(page.getByText("4 baris bank diimport.")).toBeVisible();
  await expect(page.getByTestId("bank-ringkasan")).toContainText("Belum seimbang");

  // Two lines have a ledger entry with the same amount within 3 days.
  await expect(page.getByTestId("bank-cadangan")).toHaveCount(2);
  for (const remaining of [1, 0]) {
    await page.getByTestId("bank-cadangan").first().getByRole("button", { name: "Terima" }).click();
    await expect(page.getByText("Dipadankan.", { exact: true })).toBeVisible();
    await expect(page.getByTestId("bank-cadangan")).toHaveCount(remaining);
  }

  // The cash deposit is already in the ledger as the Friday cash.
  await page.getByTestId("bank-baris").filter({ hasText: `DEPOSIT TUNAI ${tag}` }).getByRole("link").click();
  await page.getByRole("button", { name: "Tanda sebagai deposit tunai" }).click();
  await expect(page.getByText("Ditanda sebagai tunai.")).toBeVisible();

  // The online donation has no entry yet: create one from the line.
  await page.goto(`/kewangan/bank?bulan=${month}`);
  await page.getByTestId("bank-baris").filter({ hasText: `DERMA ONLINE ${tag}` }).getByRole("link").click();
  await page.getByRole("link", { name: "Cipta entri lejar" }).click();
  await expect(page.getByText("Diisi daripada baris penyata bank.", { exact: false })).toBeVisible();
  await expect(page.getByRole("textbox", { name: /^Jumlah/ })).toHaveValue("75.00");
  await page.getByRole("combobox", { name: "Dana", exact: true }).selectOption({ label: "Tabung Am" });
  await page.getByRole("combobox", { name: "Kategori", exact: true }).selectOption({ label: "Derma" });
  await page.getByRole("button", { name: "Simpan rekod" }).click();

  await expect(page).toHaveURL(new RegExp(`/kewangan/bank\\?bulan=${month}&ok=match_bank_line`));
  await expect(page.getByTestId("bank-beza")).toContainText("RM 0.00");
  await expect(page.getByTestId("bank-ringkasan")).toContainText("Seimbang");
  await expect(page.getByTestId("bank-belum")).toHaveCount(0);
  await expect(page.getByTestId("bank-lejar")).toHaveCount(0);
});

test("importing the same file again adds nothing", async ({ page, isMobile }) => {
  test.skip(isMobile, "one full run is enough");
  await signIn(page, seedEmail("a", "bendahari"));
  await page.goto("/kewangan/bank/import");
  await page.getByLabel("Fail CSV").setInputFiles(file);
  // The bank saved in the first import is chosen by itself.
  await expect(page.getByRole("combobox", { name: "Bank" })).toHaveValue(/[0-9a-f-]{36}/);
  await expect(page.getByTestId("pilih-lajur")).toHaveCount(0);
  await page.getByRole("button", { name: "Semak" }).click();
  await expect(page.getByTestId("pratonton-ringkasan")).toHaveText("0 baris baharu, 4 sudah diimport, 0 dalam bulan dikunci.");
  await expect(page.getByText("Semua baris dalam fail ini sudah diimport.", { exact: false })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Import/ })).toHaveCount(0);
});

test("Pengerusi sees the reconciliation but cannot change it; AJK cannot open it", async ({ browser, isMobile }) => {
  test.skip(isMobile, "one full run is enough");
  const pengerusi = await (await browser.newContext()).newPage();
  await signIn(pengerusi, seedEmail("a", "pengerusi"));
  await pengerusi.goto(`/kewangan/bank?bulan=${month}`);
  await expect(pengerusi.getByTestId("bank-beza")).toContainText("RM 0.00");
  await expect(pengerusi.getByRole("link", { name: "Import penyata" })).toHaveCount(0);
  await pengerusi.getByTestId("bank-sudah").locator("summary").click();
  await expect(pengerusi.getByRole("button", { name: "Nyahpadan" })).toHaveCount(0);

  const ajk = await (await browser.newContext()).newPage();
  await signIn(ajk, seedEmail("a", "ajk"));
  await ajk.goto(`/kewangan/bank?bulan=${month}`);
  await expect(ajk.getByTestId("bank-ringkasan")).toHaveCount(0);
});

// A DuitNow QR built like a real one, with a fake account.
const tlv = (id: string, value: string) => `${id}${`${value.length}`.padStart(2, "0")}${value}`;
const body = `${tlv("00", "01")}${tlv("01", "11")}${tlv("26", tlv("00", "A0000006150001") + tlv("01", "0000000"))}${tlv("52", "0000")}${tlv("53", "458")}${tlv("58", "MY")}${tlv("59", "MASJID CONTOH A")}${tlv("60", "SHAH ALAM")}6304`;
const payload = body + crc16(body);

test("Pengerusi adds the DuitNow QR from a picture and everyone can show it", async ({ page, browser, isMobile }) => {
  test.skip(isMobile, "one full run is enough");
  test.setTimeout(90_000);
  // Start with no QR, whatever an earlier run saved.
  await admin.from("masjids").update({ duitnow_payload: null, receipt_show_qr: false }).eq("id", MASJID_A);
  await signIn(page, seedEmail("a", "pengerusi"));
  await page.goto("/tetapan/duitnow");

  const picture = await QRCode.toBuffer(payload, { width: 400 });
  await page.getByLabel("Gambar QR").setInputFiles({ name: "qr.png", mimeType: "image/png", buffer: picture });
  await expect(page.getByLabel("Teks QR")).toHaveValue(payload);
  await expect(page.getByTestId("duitnow-semak")).toContainText("MASJID CONTOH A");
  await page.getByLabel("Saya sahkan nama ini ialah akaun bank masjid.").check();
  await page.getByRole("button", { name: "Simpan QR" }).click();
  await expect(page.getByTestId("duitnow-nama")).toHaveText("MASJID CONTOH A");

  await page.getByLabel("Tunjukkan QR DuitNow pada resit").check();
  await page.getByRole("button", { name: "Simpan", exact: true }).click();
  await expect(page.getByText("Disimpan.", { exact: true })).toBeVisible();

  // Even the Imam can open Terima derma and show the QR.
  const imam = await (await browser.newContext()).newPage();
  await signIn(imam, seedEmail("a", "imam"));
  await imam.goto("/derma");
  await expect(imam.getByTestId("qr-duitnow")).toBeVisible();
  await expect(imam.getByTestId("derma-poster")).toContainText("MASJID CONTOH A");
});

test("a damaged QR text is refused with a plain reason", async ({ page, isMobile }) => {
  test.skip(isMobile, "one full run is enough");
  await signIn(page, seedEmail("a", "pengerusi"));
  await page.goto("/tetapan/duitnow");
  await page.getByLabel("Teks QR").fill(payload.replace("CONTOH", "CONTOX"));
  await expect(page.getByText("Teks QR tidak lengkap atau tersalah taip", { exact: false })).toBeVisible();
  await expect(page.getByRole("button", { name: "Simpan QR" })).toBeDisabled();
});

test("Terima derma fits on a phone", async ({ page, isMobile }) => {
  test.skip(!isMobile, "phone only");
  await signIn(page, seedEmail("a", "bendahari"));
  await page.goto("/derma");
  await expect(page.getByRole("heading", { name: "Terima derma" })).toBeVisible();
  const width = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(width).toBeLessThanOrEqual(page.viewportSize()!.width);
});
