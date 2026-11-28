import { expect, test, type Page } from "@playwright/test";
import { firstRowId, masjidId, seedEmail } from "../../scripts/seed-data";
import { admin, newAccount, signIn } from "./helpers";

test.describe.configure({ mode: "serial" });

const MASJID_A = masjidId("a");

/** A fresh household in masjid A, enrolled for 2026 and unpaid, so it is in arrears. */
async function householdInArrears() {
  const name = `Ketua Tunggakan ${crypto.randomUUID().slice(0, 6)}`;
  const { data: household } = await admin.from("households").insert({ masjid_id: MASJID_A, head_name: name }).select("id").single();
  const { data: member } = await admin
    .from("khairat_members")
    .insert({ masjid_id: MASJID_A, household_id: household!.id, plan_id: firstRowId("a", "khairat_plans") })
    .select("id")
    .single();
  return { name, memberId: member!.id as string };
}

/** The Khairat fund card's balance on the dashboard, in sen. */
async function khairatFundBalance(page: Page) {
  await page.goto("/");
  const card = page.getByTestId("kad-dana").filter({ has: page.getByRole("heading", { name: "Khairat", exact: true }) });
  const text = (await card.locator("p").first().textContent()) ?? "";
  return Math.round(Number(text.replace(/[^\d.-]/g, "")) * 100);
}

test("Bendahari records a payment for a household in arrears: status, fund balance and receipt update", async ({ page, isMobile }) => {
  test.skip(isMobile, "one full run is enough");
  test.setTimeout(120_000);
  const { name, memberId } = await householdInArrears();

  await signIn(page, seedEmail("a", "bendahari"));
  const before = await khairatFundBalance(page);

  // In the arrears list.
  await page.goto("/khairat?tahun=2026&status=tunggakan");
  const row = page.getByTestId("khairat-baris").filter({ hasText: name });
  await expect(row).toContainText("Tunggakan");
  await expect(row).toContainText("RM 50.00");
  await row.click();
  await expect(page).toHaveURL(new RegExp(`/khairat/${memberId}$`));

  // The form starts with what is owed.
  await expect(page.getByRole("textbox", { name: /^Jumlah/ })).toHaveValue("50.00");
  await page.getByRole("button", { name: "Rekod bayaran" }).click();

  await expect(page.getByText("Bayaran direkod dan resit dikeluarkan.")).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 }).locator("..")).toContainText("Aktif");
  await expect(page.getByTestId("khairat-ahli-ringkasan")).toContainText("RM 0.00");

  // The receipt carries the household's name and the amount.
  await page.getByRole("link", { name: "Lihat resit" }).click();
  const preview = page.getByTestId("resit-pratonton");
  await expect(preview).toContainText(name);
  await expect(preview).toContainText("RM 50.00");
  await expect(preview).toContainText("Lima puluh ringgit sahaja");

  // The Khairat fund went up by the payment.
  expect(await khairatFundBalance(page)).toBe(before + 5_000);
});

test("a payment over what is owed keeps the form and says why", async ({ page, isMobile }) => {
  test.skip(isMobile, "one full run is enough");
  const { memberId } = await householdInArrears();
  await signIn(page, seedEmail("a", "setiausaha"));
  await page.goto(`/khairat/${memberId}`);
  await page.getByRole("textbox", { name: /^Jumlah/ }).fill("60");
  await page.getByRole("button", { name: "Rekod bayaran" }).click();
  await expect(page.getByText("Jumlah melebihi baki yuran tahun ini.")).toBeVisible();
  await expect(page.getByRole("textbox", { name: /^Jumlah/ })).toHaveValue("60");
});

test("Setiausaha enrols a household and the list can be exported", async ({ page, isMobile }) => {
  test.skip(isMobile, "one full run is enough");
  const name = `Ketua Daftar ${crypto.randomUUID().slice(0, 6)}`;
  await admin.from("households").insert({ masjid_id: MASJID_A, head_name: name });

  await signIn(page, seedEmail("a", "setiausaha"));
  await page.goto("/khairat?tahun=2026");
  await page.getByRole("link", { name: "Daftar ahli" }).click();
  await page.getByRole("searchbox", { name: "Cari isi rumah" }).fill(name);
  await page.getByRole("checkbox", { name: new RegExp(name) }).check();
  await page.getByRole("button", { name: "Daftar 1 isi rumah" }).click();

  await expect(page.getByText("1 isi rumah didaftarkan.")).toBeVisible();
  await page.getByLabel("Cari nama").fill(name);
  await page.getByRole("button", { name: "Tapis" }).click();
  await expect(page.getByTestId("khairat-baris").filter({ hasText: name })).toBeVisible();

  const download = page.waitForEvent("download");
  await page.getByRole("link", { name: "Eksport CSV" }).click();
  expect((await download).suggestedFilename()).toBe("khairat-2026.csv");
});

test("AJK sees khairat but cannot enrol or record payments", async ({ page, isMobile }) => {
  test.skip(isMobile, "one full run is enough");
  const { memberId } = await householdInArrears();
  await signIn(page, seedEmail("a", "ajk"));
  await page.goto("/khairat?tahun=2026");
  await expect(page.getByTestId("khairat-ringkasan")).toBeVisible();
  await expect(page.getByRole("link", { name: "Daftar ahli" })).toHaveCount(0);
  await page.goto(`/khairat/${memberId}`);
  await expect(page.getByRole("button", { name: "Rekod bayaran" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Tamatkan keahlian" })).toHaveCount(0);
});

test("an Asas masjid gets a clear upgrade message", async ({ browser, isMobile }) => {
  test.skip(isMobile, "one full run is enough");
  test.setTimeout(90_000);
  const page = await (await browser.newContext()).newPage();
  await signIn(page, await newAccount("Pengerusi Asas"));
  await page.getByLabel("Nama masjid atau surau").fill(`Surau Asas ${crypto.randomUUID().slice(0, 6)}`);
  await page.getByLabel("Negeri").selectOption("Selangor");
  await page.getByLabel("Alamat").fill("1 Jalan Ujian");
  await page.getByLabel("Zon waktu solat").selectOption("SGR01");
  await page.getByRole("button", { name: "Daftar masjid" }).click();
  await expect(page.getByRole("heading", { name: "Ringkasan kewangan" })).toBeVisible();

  await page.goto("/khairat");
  await expect(page.getByTestId("khairat-naik-taraf")).toContainText("Khairat untuk pelan Standard ke atas");
  // Sub-pages send them back to the message.
  await page.goto("/khairat/tetapan");
  await expect(page).toHaveURL(/\/khairat$/);
});

test("the khairat card and list fit on a phone", async ({ page, isMobile }) => {
  test.skip(!isMobile, "phone only");
  await signIn(page, seedEmail("a", "bendahari"));
  await expect(page.getByTestId("kad-khairat")).toBeVisible();
  await page.getByTestId("kad-khairat").getByRole("link", { name: "Senarai tunggakan" }).click();
  await expect(page.getByTestId("senarai-khairat")).toBeVisible();
  const width = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(width).toBeLessThanOrEqual(page.viewportSize()!.width);
});
