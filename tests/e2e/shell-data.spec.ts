import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import sharp from "sharp";
import { seedEmail } from "../../scripts/seed-data";
import { formatMinutes, malaysiaNow, pickHighlight } from "../../lib/prayer-schedule";
import { admin, env, newAccount, signIn } from "./helpers";
import { createClient } from "@supabase/supabase-js";

// The feed is blocked for the test server (playwright.config.ts), so these
// times must come from the bundled file.
function expectedTimes(zone: string) {
  const file = JSON.parse(readFileSync("data/prayer-times/2026.json", "utf8"));
  const { year, month, day, date } = malaysiaNow();
  const tomorrow = malaysiaNow(Date.now() + 86_400_000);
  const days = [
    { date, minutes: file.zones[zone][month - 1][day - 1] as number[] },
    { date: tomorrow.date, minutes: file.zones[zone][tomorrow.month - 1]?.[tomorrow.day - 1] as number[] },
  ];
  test.skip(year !== 2026, "the bundled file covers 2026");
  const shown = pickHighlight(days)!.day.minutes;
  return [0, 2, 3, 4, 5].map((i) => formatMinutes(shown[i]));
}

async function stripTimes(page: Page, isMobile: boolean) {
  const strip = page.getByTestId(isMobile ? "prayer-row" : "prayer-strip");
  await expect(strip).toBeVisible();
  return (await strip.getByRole("listitem").allInnerTexts()).map((text) => text.match(/\d{1,2}:\d{2}/)![0]);
}

test("masjid A shows its logo, place, user and its zone's prayer times", async ({ page, isMobile }) => {
  await signIn(page, seedEmail("a", "pengerusi"));

  if (isMobile) {
    await expect(page.getByText("Salam, Pengerusi Contoh A")).toBeVisible();
    await expect(page.locator("header img")).toBeVisible();
  } else {
    const sidebar = page.getByRole("complementary");
    await expect(sidebar.getByText("Masjid Contoh A")).toBeVisible();
    await expect(sidebar.getByText("Taman Contoh A")).toBeVisible();
    await expect(sidebar.getByText("Pengerusi Contoh A")).toBeVisible();
    await expect(sidebar.locator("img")).toHaveAttribute("src", /masjid-logos.*token=/);
  }

  expect(await stripTimes(page, isMobile)).toEqual(expectedTimes("SGR01"));
  const strip = page.getByTestId(isMobile ? "prayer-row" : "prayer-strip");
  await expect(strip.locator("[aria-current=time]")).toHaveCount(1);
});

test("masjid B shows initials and different prayer times", async ({ page, isMobile }) => {
  await signIn(page, seedEmail("b", "pengerusi"));

  const header = isMobile ? page.locator("header") : page.getByRole("complementary");
  await expect(header.getByText("SC", { exact: true })).toBeVisible();
  await expect(header.locator("img")).toHaveCount(0);

  const times = await stripTimes(page, isMobile);
  expect(times).toEqual(expectedTimes("PNG01"));
  expect(times).not.toEqual(expectedTimes("SGR01"));
});

test("only the Pengerusi can open the logo page", async ({ page }) => {
  await signIn(page, seedEmail("a", "bendahari"));
  await page.goto("/tetapan");
  await expect(page.getByRole("link", { name: /Logo masjid/ })).toHaveCount(0);
  await page.goto("/tetapan/logo");
  await expect(page.getByRole("heading", { name: "Tiada akses" })).toBeVisible();
});

test("a Pengerusi uploads a logo, sees it, and removes it", async ({ page, isMobile }) => {
  test.skip(isMobile, "one run is enough");

  // A fresh masjid, so the seeded logos stay as they are.
  const email = await newAccount("Pengerusi Logo");
  const client = createClient(env.url, env.anonKey, { auth: { persistSession: false } });
  await client.auth.signInWithPassword({ email, password: env.password });
  const { error } = await client.rpc("create_masjid", {
    p_name: "Surau Logo Ujian",
    p_state: "Johor",
    p_address: "",
    p_prayer_zone: "JHR02",
  });
  expect(error).toBeNull();

  await signIn(page, email);
  const sidebar = page.getByRole("complementary");
  await expect(sidebar.getByText("SL", { exact: true })).toBeVisible();

  await page.goto("/tetapan");
  await page.getByRole("link", { name: /Logo masjid/ }).click();
  await expect(page.getByRole("heading", { name: "Logo masjid" })).toBeVisible();

  // A wrong file type is refused with a plain message.
  await page.getByLabel("Fail logo").setInputFiles({ name: "logo.png", mimeType: "image/png", buffer: Buffer.from("bukan imej") });
  await page.getByRole("button", { name: "Muat naik" }).click();
  await expect(page.getByText("Hanya fail PNG atau SVG diterima.")).toBeVisible();

  const png = await sharp({ create: { width: 64, height: 64, channels: 4, background: "#0F766E" } }).png().toBuffer();
  await page.getByLabel("Fail logo").setInputFiles({ name: "logo.png", mimeType: "image/png", buffer: png });
  await page.getByRole("button", { name: "Muat naik" }).click();
  await expect(page.getByText("Logo telah dikemas kini.")).toBeVisible();
  await expect(sidebar.locator("img")).toHaveAttribute("src", /masjid-logos.*token=/);
  await expect(sidebar.getByText("SL", { exact: true })).toHaveCount(0);

  // The file is in this masjid's own folder.
  const { data: masjid } = await admin.from("masjids").select("id, logo_path").eq("name", "Surau Logo Ujian").order("created_at", { ascending: false }).limit(1).single();
  expect(masjid!.logo_path).toMatch(new RegExp(`^masjids/${masjid!.id}/logo-\\d+\\.png$`));

  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Buang logo" }).click();
  await expect(page.getByText("Logo telah dibuang.")).toBeVisible();
  await expect(sidebar.getByText("SL", { exact: true })).toBeVisible();
});
