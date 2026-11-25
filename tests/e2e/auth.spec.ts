import { expect, test } from "@playwright/test";
import { seedEmail, seedInviteToken } from "../../scripts/seed-data";
import { env, mainNav, newAccount, signIn } from "./helpers";

test("signed-out visitors are sent to sign in", async ({ page }) => {
  await page.goto("/kewangan");
  await expect(page).toHaveURL(/\/log-masuk$/);
  await expect(page.getByRole("heading", { name: "Log masuk" })).toBeVisible();
});

test("a wrong password shows a plain message", async ({ page }) => {
  await page.goto("/log-masuk");
  await page.getByLabel("Emel").first().fill(seedEmail("a", "pengerusi"));
  await page.getByLabel("Kata laluan").fill("salah-sama-sekali");
  await page.getByRole("button", { name: "Log masuk", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Emel atau kata laluan tidak betul." })).toBeVisible();
});

test("Imam sees only the home page and settings, and is stopped at other pages", async ({ page, isMobile }) => {
  test.skip(isMobile, "menu items are checked on the desktop sidebar");
  await signIn(page, seedEmail("a", "imam"));

  const nav = mainNav(page);
  await expect(nav.getByRole("link")).toHaveText(["Utama", "Tetapan"]);

  await page.goto("/kariah");
  await expect(page.getByRole("heading", { name: "Tiada akses" })).toBeVisible();
  await page.goto("/tetapan/pengguna");
  await expect(page.getByRole("heading", { name: "Tiada akses" })).toBeVisible();
});

test("create a masjid, invite a Bendahari, and each sees a different menu", async ({ browser, isMobile }) => {
  test.skip(isMobile, "one full run is enough; menus are checked on the desktop sidebar");
  test.setTimeout(120_000);

  const run = crypto.randomUUID().slice(0, 8);
  const masjidName = `Masjid Ujian ${run}`;

  // 1. A new person registers a masjid and becomes its Pengerusi.
  const pengerusiEmail = await newAccount("Pengerusi Ujian");
  const pengerusi = await (await browser.newContext()).newPage();
  await signIn(pengerusi, pengerusiEmail);
  await expect(pengerusi).toHaveURL(/\/mula$/);

  await pengerusi.getByLabel("Nama masjid atau surau").fill(masjidName);
  await pengerusi.getByLabel("Negeri").selectOption("Selangor");
  await pengerusi.getByLabel("Alamat").fill("1 Jalan Ujian");
  await pengerusi.getByLabel("Zon waktu solat").selectOption("SGR01");
  await pengerusi.getByRole("button", { name: "Daftar masjid" }).click();

  await expect(pengerusi.getByRole("heading", { name: "Utama" })).toBeVisible();
  await expect(pengerusi.getByRole("complementary").getByText(masjidName)).toBeVisible();
  await expect(mainNav(pengerusi).getByRole("link")).toHaveText([
    "Utama",
    "Kewangan",
    "Kariah",
    "Khairat",
    "Laporan",
    "Tetapan",
  ]);

  // 2. The Pengerusi invites a Bendahari and copies the link.
  const bendahariEmail = `e2e-${crypto.randomUUID()}@example.test`;
  await pengerusi.goto("/tetapan");
  await pengerusi.getByRole("link", { name: /Pengguna/ }).click();
  await pengerusi.getByLabel("Emel").fill(bendahariEmail);
  await pengerusi.getByLabel("Peranan").selectOption("bendahari");
  await pengerusi.getByRole("button", { name: "Hantar jemputan" }).click();
  const link = await pengerusi.getByTestId("invite-link").inputValue();
  expect(link).toContain("/jemput/");
  await expect(pengerusi.getByText(bendahariEmail).last()).toBeVisible();

  // 3. The Bendahari opens the link in their own browser and joins.
  const bendahari = await (await browser.newContext()).newPage();
  await bendahari.goto(new URL(link).pathname);
  await expect(bendahari.getByText(masjidName)).toBeVisible();
  await bendahari.getByLabel("Nama penuh").fill("Bendahari Ujian");
  await bendahari.getByLabel("Kata laluan").fill(env.password);
  await bendahari.getByRole("button", { name: "Terima jemputan" }).click();

  await expect(bendahari.getByRole("heading", { name: "Utama" })).toBeVisible();
  const sidebar = bendahari.getByRole("complementary");
  await expect(sidebar.getByText(masjidName)).toBeVisible();
  await expect(sidebar.getByText("Bendahari", { exact: true })).toBeVisible();
  await expect(mainNav(bendahari).getByRole("link")).toHaveText([
    "Utama",
    "Kewangan",
    "Kariah",
    "Khairat",
    "Laporan",
    "Tetapan",
  ]);

  // 4. Same masjid, different menus and powers.
  await bendahari.goto("/tetapan");
  await expect(bendahari.getByRole("link", { name: /Pengguna/ })).toHaveCount(0);
  await bendahari.goto("/tetapan/pengguna");
  await expect(bendahari.getByRole("heading", { name: "Tiada akses" })).toBeVisible();

  // 5. The link cannot be used twice.
  const stranger = await (await browser.newContext()).newPage();
  await stranger.goto(new URL(link).pathname);
  await expect(stranger.getByText("Jemputan ini sudah digunakan")).toBeVisible();

  // 6. Masjid B's invitation link does not let this Bendahari in.
  await bendahari.goto(`/jemput/${seedInviteToken("b")}`);
  await expect(bendahari.getByText(/Jemputan ini untuk emel lain/)).toBeVisible();
  await expect(bendahari.getByRole("button", { name: "Terima jemputan" })).toHaveCount(0);

  // 7. Back in the Pengerusi's list, the Bendahari is an active member.
  await pengerusi.reload();
  await expect(pengerusi.getByText("Bendahari Ujian", { exact: true })).toBeVisible();
});
