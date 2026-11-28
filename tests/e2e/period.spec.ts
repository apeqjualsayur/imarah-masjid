import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { masjidId, seedEmail, type Role } from "../../scripts/seed-data";
import { admin, createClient, env, signIn } from "./helpers";

test.describe.configure({ mode: "serial" });

const MASJID_A = masjidId("a");
const tag = crypto.randomUUID().slice(0, 6);

async function as(role: Role) {
  const client = createClient(env.url, env.anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await client.auth.signInWithPassword({ email: seedEmail("a", role), password: env.password });
  if (error) throw new Error(error.message);
  return client;
}

/** A past month that is open and has nothing waiting, picked at random so runs do not collide. */
async function openMonth() {
  const [{ data: periods }, { data: pending }] = await Promise.all([
    admin.from("periods").select("month").eq("masjid_id", MASJID_A).not("locked_at", "is", null),
    admin.from("collections").select("date").eq("masjid_id", MASJID_A).in("status", ["counted", "needs_review"]),
  ]);
  const taken = new Set([...(periods ?? []).map((row) => (row.month as string).slice(0, 7)), ...(pending ?? []).map((row) => (row.date as string).slice(0, 7))]);
  for (;;) {
    const month = `${2001 + Math.floor(Math.random() * 24)}-${`${1 + Math.floor(Math.random() * 12)}`.padStart(2, "0")}`;
    if (!taken.has(month)) return month;
  }
}

let month = "";
test.beforeAll(async () => {
  month = await openMonth();
});

test.afterAll(async () => {
  // Leave the month open whatever happened, so other runs can use it.
  const pengerusi = await as("pengerusi");
  await pengerusi.rpc("unlock_month", { p_month: `${month}-01`, p_reason: "Selesai ujian" });
});

test("a pending collection stops the lock", async ({ page, isMobile }) => {
  test.skip(isMobile, "one full run is enough");
  const bendahari = await as("bendahari");
  const { data: fund } = await admin.from("funds").select("id").eq("masjid_id", MASJID_A).eq("name", "Tabung Am").single();
  const { data: id } = await bendahari.rpc("record_collection", { p_key: crypto.randomUUID(), p_date: `${month}-07`, p_fund_id: fund!.id, p_total_sen: 25_000 });

  await signIn(page, seedEmail("a", "pengerusi"));
  await page.goto(`/kewangan/tutup-bulan/${month}`);
  await expect(page.getByTestId("semak-collections")).toHaveAttribute("data-state", "block");
  await expect(page.getByText("Bulan ini belum boleh dikunci kerana ada kutipan yang belum selesai.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Kunci bulan" })).toBeDisabled();

  const pengerusi = await as("pengerusi");
  await pengerusi.rpc("cancel_collection", { p_id: id, p_reason: `Ujian tutup bulan ${tag}` });
  await page.reload();
  await expect(page.getByTestId("semak-collections")).toHaveAttribute("data-state", "ok");
});

test("lock, every change refused, unlock with a reason, and all of it in the audit log", async ({ page, browser, isMobile }) => {
  test.skip(isMobile, "one full run is enough");
  test.setTimeout(150_000);

  // 1. The Pengerusi locks the month from the checklist.
  await signIn(page, seedEmail("a", "pengerusi"));
  await page.goto("/kewangan/tutup-bulan");
  await expect(page.getByTestId("senarai-bulan")).toBeVisible();
  await page.goto(`/kewangan/tutup-bulan/${month}`);
  await expect(page.getByTestId("senarai-semak")).toBeVisible();
  const understood = page.getByRole("checkbox", { name: /mahu mengunci juga/ });
  if (await understood.count()) await understood.check();
  await page.getByRole("button", { name: "Kunci bulan" }).click();
  await expect(page.getByText("Bulan dikunci.")).toBeVisible();
  await expect(page.getByTestId("bulan-dikunci")).toContainText("Dikunci oleh Pengerusi Contoh A");

  // 2. The Bendahari tries to record an entry in it: a plain refusal.
  const bendahari = await (await browser.newContext()).newPage();
  await signIn(bendahari, seedEmail("a", "bendahari"));
  await bendahari.goto("/kewangan/baru");
  await bendahari.getByRole("radio", { name: /^Terima/ }).check();
  await bendahari.getByLabel("Tarikh").fill(`${month}-10`);
  await bendahari.getByRole("combobox", { name: "Dana", exact: true }).selectOption({ label: "Tabung Am" });
  await bendahari.getByRole("combobox", { name: "Kategori", exact: true }).selectOption({ label: "Derma" });
  await bendahari.getByRole("textbox", { name: /^Jumlah/ }).fill("10.00");
  await bendahari.getByRole("button", { name: "Simpan rekod" }).click();
  await expect(bendahari.getByText("Bulan ini sudah dikunci", { exact: false })).toBeVisible();

  // The Bendahari sees the lock but cannot unlock.
  await bendahari.goto(`/kewangan/tutup-bulan/${month}`);
  await expect(bendahari.getByTestId("bulan-dikunci")).toBeVisible();
  await expect(bendahari.getByRole("button", { name: "Buka kunci" })).toHaveCount(0);

  // 3. The Pengerusi unlocks with a reason.
  const reason = `Betulkan bil salah dana ${tag}`;
  await page.getByLabel("Sebab buka kunci").fill(reason);
  await page.getByRole("button", { name: "Buka kunci" }).click();
  await expect(page.getByText("Kunci dibuka.", { exact: false })).toBeVisible();
  await expect(page.getByTestId("sejarah-kunci")).toContainText(reason);
  await expect(page.getByTestId("senarai-semak")).toBeVisible();

  // 4. The audit log shows the lock and the unlock with the reason.
  await page.goto("/tetapan/audit?jenis=bulan");
  const unlock = page.getByTestId("audit-baris").filter({ hasText: reason }).first();
  await expect(unlock).toContainText("Buka kunci");
  await expect(unlock).toContainText("Pengerusi Contoh A");
  await expect(page.getByTestId("audit-baris").filter({ hasText: "Kunci bulan" }).first()).toBeVisible();

  const download = page.waitForEvent("download");
  await page.getByRole("link", { name: "Eksport CSV" }).click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/^log-audit-\d{4}-\d{2}-\d{2}\.csv$/);
  expect(await readFile((await file.path())!, "utf8")).toContain(reason);

  // 5. The Bendahari can read the log but not export it.
  await bendahari.goto("/tetapan/audit?jenis=bulan");
  await expect(bendahari.getByTestId("audit-baris").filter({ hasText: reason }).first()).toBeVisible();
  await expect(bendahari.getByRole("link", { name: "Eksport CSV" })).toHaveCount(0);
  const refused = await bendahari.request.get("/tetapan/audit/eksport");
  expect(await refused.text()).not.toContain(reason);
});

test("the audit log is closed to other roles", async ({ page, isMobile }) => {
  test.skip(isMobile, "one full run is enough");
  await signIn(page, seedEmail("a", "setiausaha"));
  await page.goto("/tetapan/audit");
  await expect(page.getByRole("heading", { name: "Tiada akses" })).toBeVisible();
});

test("the audit log and close month screens fit on a phone", async ({ page, isMobile }) => {
  test.skip(!isMobile, "phone only");
  await signIn(page, seedEmail("a", "pengerusi"));
  for (const [path, heading] of [
    ["/tetapan/audit", "Log audit"],
    ["/kewangan/tutup-bulan", "Tutup bulan"],
    [`/kewangan/tutup-bulan/${month}`, null],
    ["/kewangan/tutup-bulan/2026-09", null],
  ] as const) {
    await page.goto(path);
    if (heading) await expect(page.getByRole("heading", { name: heading, level: 1 })).toBeVisible();
    else await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    const width = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(width, path).toBeLessThanOrEqual(page.viewportSize()!.width);
  }
});
