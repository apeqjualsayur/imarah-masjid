import { expect, test } from "@playwright/test";
import { seedEmail } from "../../scripts/seed-data";
import { signIn } from "./helpers";

test.describe.configure({ mode: "serial" });

test("AJK counts by notes; the AJK cannot confirm; a different amount needs checking; then it is confirmed and posted", async ({
  browser,
  isMobile,
}) => {
  test.skip(isMobile, "the phone run below covers the phone layout");
  test.setTimeout(150_000);
  const tag = `Kutipan ujian ${crypto.randomUUID().slice(0, 6)}`;

  // 1. The AJK counts: 3 x RM100 + 2 x RM50 + RM4.50 coins = RM 404.50.
  const ajk = await (await browser.newContext()).newPage();
  await signIn(ajk, seedEmail("a", "ajk"));
  await ajk.goto("/");
  await ajk.getByRole("link", { name: "Rekod kutipan" }).click();
  await ajk.getByRole("button", { name: "Kira ikut pecahan wang" }).click();
  await ajk.getByLabel("Bilangan not RM100").fill("3");
  await ajk.getByLabel("Bilangan not RM50").fill("2");
  await ajk.getByLabel("Jumlah syiling (RM)").fill("4.50");
  await expect(ajk.getByTestId("jumlah-pecahan")).toContainText("RM 404.50");
  await ajk.getByLabel("Catatan").fill(tag);
  await ajk.getByRole("button", { name: "Simpan kiraan" }).click();

  await expect(ajk).toHaveURL(/\/kewangan\/kutipan\/[0-9a-f-]{36}\?hasil=dikira/);
  const url = ajk.url().split("?")[0];
  await expect(ajk.getByText("Kiraan disimpan")).toBeVisible();
  await expect(ajk.getByTestId("jumlah-kutipan")).toHaveText("RM 404.50");
  await expect(ajk.getByText("Anda yang mengira kutipan ini")).toBeVisible();
  await expect(ajk.getByRole("heading", { name: "Sahkan kutipan" })).toHaveCount(0);

  // 2. The Bendahari sees it waiting, without the first figure, and enters a different amount.
  const bendahari = await (await browser.newContext()).newPage();
  await signIn(bendahari, seedEmail("a", "bendahari"));
  await bendahari.goto("/");
  await expect(bendahari.getByRole("heading", { name: /Perlu tindakan/ })).toBeVisible();
  await bendahari.goto(url);
  await expect(bendahari.getByTestId("jumlah-kutipan")).toContainText("Disembunyikan");
  await bendahari.getByRole("textbox", { name: "Jumlah yang anda kira" }).fill("400");
  await bendahari.getByRole("button", { name: "Sahkan", exact: true }).click();
  await expect(bendahari.getByText("Jumlah anda berbeza")).toBeVisible();
  await expect(bendahari.getByTestId("perlu-semak")).toContainText("RM 404.50");
  await expect(bendahari.getByTestId("perlu-semak")).toContainText("RM 400.00");

  // 3. After counting together, the Bendahari enters the agreed figure and becomes the counter.
  await bendahari.getByRole("textbox", { name: "Jumlah baharu" }).fill("404.50");
  await bendahari.getByRole("button", { name: "Simpan kiraan semula" }).click();
  await expect(bendahari.getByText("Anda yang mengira kutipan ini")).toBeVisible();

  // 4. The AJK confirms with the same figure; the receipt goes into the ledger.
  await ajk.goto(url);
  await ajk.getByRole("textbox", { name: "Jumlah yang anda kira" }).fill("404.50");
  await ajk.getByRole("button", { name: "Sahkan", exact: true }).click();
  await expect(ajk.getByText(/Disahkan\. Resit RC-\d{4}-\d{4,} telah direkod/)).toBeVisible();

  await ajk.getByRole("link", { name: /^RC-\d{4}-\d{4,}$/ }).click();
  await expect(ajk.getByRole("heading", { name: "Kutipan Jumaat" })).toBeVisible();
  await expect(ajk.getByText("+RM 404.50")).toBeVisible();
  await expect(ajk.getByText(tag)).toBeVisible();
});

test("a count made with no signal waits on the phone and sends itself when the signal returns", async ({ browser }) => {
  test.setTimeout(90_000);
  const sen = 10_000 + Math.floor(Math.random() * 89_999);
  const typed = (sen / 100).toFixed(2);
  const shown = `RM ${Number(typed).toLocaleString("en-US", { minimumFractionDigits: 2 })}`;

  const context = await browser.newContext();
  const page = await context.newPage();
  await signIn(page, seedEmail("a", "ajk"));
  await page.goto("/kewangan/kutipan/baru");
  await expect(page.getByRole("button", { name: "Simpan kiraan" })).toBeVisible();

  await context.setOffline(true);
  await page.getByRole("textbox", { name: "Jumlah dikira" }).fill(typed);
  await page.getByRole("button", { name: "Simpan kiraan" }).click();
  await expect(page.getByText("Tiada isyarat. Kiraan disimpan dalam telefon ini")).toBeVisible();
  const queue = page.getByTestId("belum-dihantar");
  await expect(queue).toContainText("Belum dihantar");
  await expect(queue).toContainText(shown);

  await context.setOffline(false);
  await expect(queue).toHaveCount(0, { timeout: 20_000 });

  await page.goto("/kewangan/kutipan");
  await expect(page.getByTestId("kutipan-menunggu").getByTestId("baris-kutipan").filter({ hasText: shown })).toHaveCount(1);
});

test("Setiausaha and Imam cannot count", async ({ browser }) => {
  for (const role of ["setiausaha", "imam"] as const) {
    const page = await (await browser.newContext()).newPage();
    await signIn(page, seedEmail("a", role));
    await page.goto("/kewangan/kutipan/baru");
    await expect(page).toHaveURL(/\/tiada-akses$/);
  }
});
