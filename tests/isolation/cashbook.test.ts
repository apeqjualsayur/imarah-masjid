import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeAll, describe, expect, it } from "vitest";
import { todayInMalaysia } from "../../lib/cashbook";
import { parseRinggit } from "../../lib/money";
import { firstRowId, masjidId, OPEN_DATE, type Role } from "../../scripts/seed-data";
import {
  EXPECTED_AM_NOVEMBER,
  EXPECTED_BALANCES,
  EXPECTED_MONTHS,
  EXPECTED_TOTAL,
  FUND_NAMES,
  REVERSAL_DATE,
  REVERSED,
  TEN_ENTRIES,
  type FundKey,
} from "../fixtures/ten-entries";
import { admin, anon, newUser, PERMISSION_DENIED, userClient } from "./helpers";

const MASJID_A = masjidId("a");
const MASJID_B = masjidId("b");
const INCOME_CATEGORY = firstRowId("a", "categories"); // Kutipan Jumaat
const CHECK_VIOLATION = "23514";

const entry = (overrides = {}) => ({
  fund_id: firstRowId("a", "funds"),
  amount_sen: 4_200,
  direction: "in",
  date: OPEN_DATE,
  method: "cash",
  ...overrides,
});

async function bendahari() {
  return userClient("a", "bendahari");
}

async function record(overrides = {}) {
  const { data, error } = await (await bendahari()).from("transactions").insert(entry(overrides)).select().single();
  expect(error).toBeNull();
  return data;
}

async function newFund(client: SupabaseClient, extra = {}) {
  const { data, error } = await client
    .from("funds")
    .insert({ name: `Dana Ujian ${crypto.randomUUID()}`, ...extra })
    .select()
    .single();
  expect(error).toBeNull();
  return data;
}

describe("rules for a new entry", () => {
  it("refuses a date after today in Malaysia", async () => {
    const tomorrow = new Date(Date.now() + 36 * 3600 * 1000);
    const { error } = await (await bendahari()).from("transactions").insert(entry({ date: todayInMalaysia(tomorrow) }));
    expect(error?.message).toContain("in the future");
  });

  it("accepts today", async () => {
    await record({ date: todayInMalaysia() });
  });

  it("refuses an income category on a payment", async () => {
    const { error } = await (await bendahari()).from("transactions").insert(entry({ direction: "out", category_id: INCOME_CATEGORY }));
    expect(error?.message).toContain("does not match");
  });

  it("accepts an income category on a receipt", async () => {
    await record({ category_id: INCOME_CATEGORY });
  });

  it("refuses an archived fund", async () => {
    const fund = await newFund(await bendahari(), { archived_at: new Date().toISOString() });
    const { error } = await (await bendahari()).from("transactions").insert(entry({ fund_id: fund.id }));
    expect(error?.message).toContain("fund is archived");
  });

  it("refuses an archived category", async () => {
    const client = await bendahari();
    const { data: category } = await client
      .from("categories")
      .insert({ name: `Kategori Ujian ${crypto.randomUUID()}`, type: "income", archived_at: new Date().toISOString() })
      .select()
      .single();
    const { error } = await client.from("transactions").insert(entry({ category_id: category.id }));
    expect(error?.message).toContain("category is archived");
  });

  it("an ordinary entry cannot carry a cancellation reason", async () => {
    const { error } = await (await bendahari()).from("transactions").insert(entry({ reversal_reason: "palsu" }));
    expect(error?.message).toContain("only a reversal");
  });

  it("an attachment must be in the masjid's own folder", async () => {
    const { error } = await (await bendahari())
      .from("transactions")
      .insert(entry({ attachment_path: `masjids/${MASJID_B}/bukti.pdf` }));
    expect(error?.code).toBe(CHECK_VIOLATION);
  });

  it("a note over 500 characters is refused", async () => {
    const { error } = await (await bendahari()).from("transactions").insert(entry({ note: "x".repeat(501) }));
    expect(error?.code).toBe(CHECK_VIOLATION);
  });
});

describe("cancelling an entry", () => {
  const reversal = (original: { id: string; amount_sen: number; fund_id: string; category_id: string | null }, overrides = {}) =>
    entry({
      reverses_id: original.id,
      fund_id: original.fund_id,
      category_id: original.category_id,
      amount_sen: original.amount_sen,
      direction: "out",
      reversal_reason: "Jumlah salah",
      ...overrides,
    });

  it("needs a reason", async () => {
    const original = await record();
    const client = await bendahari();
    expect((await client.from("transactions").insert(reversal(original, { reversal_reason: null }))).error?.message).toContain(
      "reason is required",
    );
    expect((await client.from("transactions").insert(reversal(original, { reversal_reason: "   " }))).error?.message).toContain(
      "reason is required",
    );
  });

  it("keeps the original's category, even an income category on the way out", async () => {
    const original = await record({ category_id: INCOME_CATEGORY });
    const client = await bendahari();
    expect((await client.from("transactions").insert(reversal(original, { category_id: null }))).error?.message).toContain(
      "keep the category",
    );
    expect((await client.from("transactions").insert(reversal(original))).error).toBeNull();
  });

  it("cannot be dated before the original", async () => {
    const original = await record({ date: OPEN_DATE });
    const { error } = await (await bendahari()).from("transactions").insert(reversal(original, { date: "2026-10-01" }));
    expect(error?.message).toContain("before the original");
  });

  it.each(["setiausaha", "ajk", "imam"] as Role[])("%s cannot cancel", async (role) => {
    const original = await record();
    const { error } = await (await userClient("a", role)).from("transactions").insert(reversal(original));
    expect(error?.code).toBe(PERMISSION_DENIED);
  });

  it("Pengerusi can cancel, but only as a reversal", async () => {
    const original = await record();
    const client = await userClient("a", "pengerusi");
    expect((await client.from("transactions").insert(reversal(original))).error).toBeNull();
  });
});

describe("archiving a fund", () => {
  it("is refused while the fund has money in it, and allowed once it is back to zero", async () => {
    const client = await bendahari();
    const fund = await newFund(client);
    await record({ fund_id: fund.id, amount_sen: 4_200 });
    const archive = () => client.from("funds").update({ archived_at: new Date().toISOString() }).eq("id", fund.id).select();
    expect((await archive()).error?.message).toContain("with money in it");

    await record({ fund_id: fund.id, amount_sen: 4_200, direction: "out" });
    expect((await archive()).error).toBeNull();
  });

  it("works at a zero balance, and the fund can come back", async () => {
    const client = await userClient("a", "pengerusi");
    const fund = await newFund(client);
    const archived = await client.from("funds").update({ archived_at: new Date().toISOString() }).eq("id", fund.id).select();
    expect(archived.error).toBeNull();
    const back = await client.from("funds").update({ archived_at: null }).eq("id", fund.id).select();
    expect(back.error).toBeNull();
    await client.from("funds").update({ archived_at: new Date().toISOString() }).eq("id", fund.id);
  });

  it.each(["setiausaha", "ajk", "imam"] as Role[])("%s cannot archive or rename a fund", async (role) => {
    const { data, error } = await (await userClient("a", role))
      .from("funds")
      .update({ name: "diubah", archived_at: new Date().toISOString() })
      .eq("id", firstRowId("a", "funds"))
      .select();
    if (error) expect(error.code).toBe(PERMISSION_DENIED);
    else expect(data).toEqual([]);
  });
});

describe("balances and totals", () => {
  it.each(["pengerusi", "bendahari", "setiausaha", "ajk"] as Role[])("%s gets fund balances for masjid A only", async (role) => {
    const { data, error } = await (await userClient("a", role)).rpc("fund_summary", { p_from: null, p_to: null });
    expect(error).toBeNull();
    const ids = (data as { id: string }[]).map((row) => row.id);
    expect(ids).toContain(firstRowId("a", "funds"));
    expect(ids).not.toContain(firstRowId("b", "funds"));
  });

  it("Imam gets no fund balances", async () => {
    const { data } = await (await userClient("a", "imam")).rpc("fund_summary", { p_from: null, p_to: null });
    expect(data).toEqual([]);
  });

  it("Imam gets the totals, and they match what the finance roles see", async () => {
    const { data: imam } = await (await userClient("a", "imam")).rpc("masjid_totals", { p_month: "2026-10-01" });
    const { data: pengerusi } = await (await userClient("a", "pengerusi")).rpc("masjid_totals", { p_month: "2026-10-01" });
    expect(imam).toHaveLength(1);
    expect(imam).toEqual(pengerusi);
  });

  it("masjid B's totals do not include masjid A's money", async () => {
    const before = (await (await userClient("b", "pengerusi")).rpc("masjid_totals", { p_month: OPEN_DATE })).data[0];
    await record({ amount_sen: 777_777 });
    const after = (await (await userClient("b", "pengerusi")).rpc("masjid_totals", { p_month: OPEN_DATE })).data[0];
    expect(after).toEqual(before);
  });

  it("visitors who are not signed in get nothing", async () => {
    expect((await anon.rpc("fund_summary", {})).error).not.toBeNull();
    expect((await anon.rpc("masjid_totals", { p_month: OPEN_DATE })).error).not.toBeNull();
  });

  it("names of the masjid's own people only, without emails", async () => {
    const { data } = await (await userClient("a", "ajk")).rpc("member_names");
    const rows = data as { user_id: string; full_name: string }[];
    expect(rows.map((row) => row.full_name)).toContain("Bendahari Contoh A");
    expect(rows.map((row) => row.full_name)).not.toContain("Bendahari Contoh B");
    expect(JSON.stringify(rows)).not.toContain("@");
  });
});

describe("ten known entries in a fresh masjid, one cancelled", () => {
  let masjid: string;
  let treasurer: SupabaseClient;
  let chair: SupabaseClient;
  const fundIds = {} as Record<FundKey, string>;
  const entryIds = new Map<number, string>();

  beforeAll(async () => {
    const pengerusi = await newUser();
    chair = pengerusi.client;
    const { data, error } = await chair.rpc("create_masjid", {
      p_name: `Masjid Ujian Lejar ${crypto.randomUUID().slice(0, 8)}`,
      p_state: "Selangor",
      p_address: "",
      p_prayer_zone: "SGR01",
    });
    if (error) throw new Error(error.message);
    masjid = data as string;

    const bendahariUser = await newUser();
    treasurer = bendahariUser.client;
    const { error: joinError } = await admin
      .from("memberships")
      .insert({ user_id: bendahariUser.id, masjid_id: masjid, role: "bendahari" });
    if (joinError) throw new Error(joinError.message);

    // Asas starts with two funds; the third is added for this test.
    await chair.from("funds").insert({ name: FUND_NAMES.jariah });
    const { data: funds } = await treasurer.from("funds").select("id, name");
    for (const key of Object.keys(FUND_NAMES) as FundKey[]) {
      fundIds[key] = funds!.find((fund) => fund.name === FUND_NAMES[key])!.id;
    }

    const { data: categories } = await treasurer.from("categories").select("id, name, type");
    for (const item of TEN_ENTRIES) {
      const amount = parseRinggit(item.amount);
      if (!amount.ok) throw new Error(item.amount);
      const category = categories!.find(
        (row) => row.name === item.category && row.type === (item.direction === "in" ? "income" : "expense"),
      )!;
      const { data: saved, error: saveError } = await treasurer
        .from("transactions")
        .insert({
          date: item.date,
          fund_id: fundIds[item.fund],
          category_id: category.id,
          direction: item.direction,
          amount_sen: amount.sen,
          method: "cash",
        })
        .select("id")
        .single();
      if (saveError) throw new Error(saveError.message);
      entryIds.set(item.n, saved.id);
    }

    const original = TEN_ENTRIES.find((item) => item.n === REVERSED)!;
    const { data: originalRow } = await treasurer
      .from("transactions")
      .select("category_id")
      .eq("id", entryIds.get(REVERSED)!)
      .single();
    const { error: reverseError } = await treasurer.from("transactions").insert({
      reverses_id: entryIds.get(REVERSED),
      fund_id: fundIds[original.fund],
      category_id: originalRow!.category_id,
      amount_sen: original.sen,
      direction: "in",
      date: REVERSAL_DATE,
      method: "cash",
      reversal_reason: "Gaji direkod dua kali",
    });
    if (reverseError) throw new Error(reverseError.message);
  });

  it("a new masjid starts with the default funds and categories", async () => {
    const { data: funds } = await admin.from("funds").select("name, restricted").eq("masjid_id", masjid).order("created_at");
    expect(funds!.slice(0, 2)).toEqual([
      { name: "Tabung Am", restricted: false },
      { name: "Pembangunan", restricted: true },
    ]);
    const { data: categories } = await admin.from("categories").select("name, type").eq("masjid_id", masjid);
    expect(categories).toHaveLength(10);
    expect(categories!.filter((row) => row.type === "income").map((row) => row.name).sort()).toEqual(
      ["Derma", "Khairat", "Kutipan Jumaat", "Lain-lain", "Sewaan dewan"].sort(),
    );
    expect(categories!.filter((row) => row.type === "expense").map((row) => row.name).sort()).toEqual(
      ["Bil elektrik/air", "Gaji", "Kebajikan", "Lain-lain", "Penyelenggaraan"].sort(),
    );
  });

  it("only the Bendahari can record an entry", async () => {
    const { error } = await chair.from("transactions").insert({
      fund_id: fundIds.am,
      amount_sen: 100,
      direction: "in",
      date: "2026-11-01",
      method: "cash",
    });
    expect(error?.code).toBe(PERMISSION_DENIED);
  });

  it("each fund's balance matches the hand-worked figure", async () => {
    const { data } = await treasurer.rpc("fund_summary", { p_from: null, p_to: null });
    const balances = Object.fromEntries(
      (Object.keys(FUND_NAMES) as FundKey[]).map((key) => [key, (data as { id: string; closing_sen: number }[]).find((row) => row.id === fundIds[key])!.closing_sen]),
    );
    expect(balances).toEqual(EXPECTED_BALANCES);
  });

  it.each(Object.entries(EXPECTED_MONTHS))("%s: total of all funds, income and expense match", async (month, expected) => {
    const { data } = await treasurer.rpc("masjid_totals", { p_month: `${month}-01` });
    expect(data).toEqual([{ total_sen: EXPECTED_TOTAL, month_in_sen: expected.in_sen, month_out_sen: expected.out_sen }]);
  });

  it("Tabung Am's November opening, in, out and closing match", async () => {
    const { data } = await treasurer.rpc("fund_summary", { p_from: "2026-11-01", p_to: "2026-11-30" });
    const am = (data as { id: string }[]).find((row) => row.id === fundIds.am);
    expect(am).toMatchObject(EXPECTED_AM_NOVEMBER);
  });

  it("the cancelled entry stays in the ledger, linked to its cancellation", async () => {
    const { data } = await treasurer.from("transactions").select("id, reverses_id, reversal_reason").eq("reverses_id", entryIds.get(REVERSED)!);
    expect(data).toHaveLength(1);
    const { data: original } = await treasurer.from("transactions").select("id").eq("id", entryIds.get(REVERSED)!);
    expect(original).toHaveLength(1);
  });

  it("an entry cannot be cancelled twice", async () => {
    const original = TEN_ENTRIES.find((item) => item.n === REVERSED)!;
    const { error } = await treasurer.from("transactions").insert({
      reverses_id: entryIds.get(REVERSED),
      fund_id: fundIds[original.fund],
      amount_sen: original.sen,
      direction: "in",
      date: REVERSAL_DATE,
      method: "cash",
      reversal_reason: "Sekali lagi",
    });
    expect(error).not.toBeNull();
  });

  it("masjid A sees none of it", async () => {
    const { data } = await (await userClient("a", "pengerusi")).from("transactions").select("id").in("id", [...entryIds.values()]);
    expect(data).toEqual([]);
    const { data: funds } = await (await userClient("a", "bendahari")).rpc("fund_summary", { p_from: null, p_to: null });
    expect((funds as { id: string }[]).map((row) => row.id)).not.toContain(fundIds.am);
  });
});

describe("attachment files", () => {
  const BUCKET = "transaction-files";
  const FILE_B = `masjids/${MASJID_B}/bukti-b.pdf`;
  const PDF = new TextEncoder().encode("%PDF-1.4\n%contoh\n");
  const storage = async (role: Role) => (await userClient("a", role)).storage.from(BUCKET);
  const exists = async (path: string) => (await admin.storage.from(BUCKET).download(path)).data !== null;

  beforeAll(async () => {
    const { error } = await admin.storage.from(BUCKET).upload(FILE_B, PDF, { contentType: "application/pdf", upsert: true });
    if (error) throw new Error(error.message);
  });

  it.each(["pengerusi", "bendahari", "setiausaha", "ajk", "imam"] as Role[])("%s of masjid A cannot reach B's file", async (role) => {
    const bucket = await storage(role);
    expect((await bucket.download(FILE_B)).data).toBeNull();
    expect((await bucket.createSignedUrl(FILE_B, 60)).data?.signedUrl).toBeFalsy();
    expect((await bucket.list(`masjids/${MASJID_B}`)).data ?? []).toEqual([]);
    const path = `masjids/${MASJID_B}/serang-${role}.pdf`;
    await bucket.upload(path, PDF, { contentType: "application/pdf" });
    expect(await exists(path)).toBe(false);
    await bucket.remove([FILE_B]);
    expect(await exists(FILE_B)).toBe(true);
  });

  it.each(["pengerusi", "setiausaha", "ajk", "imam"] as Role[])("%s cannot upload an attachment", async (role) => {
    const path = `masjids/${MASJID_A}/cuba-${role}-${crypto.randomUUID()}.pdf`;
    expect((await (await storage(role)).upload(path, PDF, { contentType: "application/pdf" })).error).not.toBeNull();
    expect(await exists(path)).toBe(false);
  });

  it("Bendahari uploads; finance roles can open it; the Imam cannot", async () => {
    const path = `masjids/${MASJID_A}/${crypto.randomUUID()}.pdf`;
    expect((await (await storage("bendahari")).upload(path, PDF, { contentType: "application/pdf" })).error).toBeNull();
    for (const role of ["pengerusi", "bendahari", "setiausaha", "ajk"] as Role[]) {
      const { data } = await (await storage(role)).createSignedUrl(path, 60);
      expect((await fetch(data!.signedUrl)).status).toBe(200);
    }
    expect((await (await storage("imam")).createSignedUrl(path, 60)).data?.signedUrl).toBeFalsy();
  });

  it("a file saved with an entry is evidence and cannot be deleted", async () => {
    const path = `masjids/${MASJID_A}/${crypto.randomUUID()}.pdf`;
    const bucket = await storage("bendahari");
    await bucket.upload(path, PDF, { contentType: "application/pdf" });
    await record({ attachment_path: path });
    await bucket.remove([path]);
    expect(await exists(path)).toBe(true);
  });

  it("an upload that never became an entry can be tidied away", async () => {
    const path = `masjids/${MASJID_A}/${crypto.randomUUID()}.pdf`;
    const bucket = await storage("bendahari");
    await bucket.upload(path, PDF, { contentType: "application/pdf" });
    expect((await bucket.remove([path])).error).toBeNull();
    expect(await exists(path)).toBe(false);
  });

  it("a file cannot be replaced", async () => {
    const path = `masjids/${MASJID_A}/${crypto.randomUUID()}.pdf`;
    const bucket = await storage("bendahari");
    await bucket.upload(path, PDF, { contentType: "application/pdf" });
    await bucket.upload(path, new TextEncoder().encode("%PDF-1.4\nlain\n"), { contentType: "application/pdf", upsert: true });
    const { data } = await admin.storage.from(BUCKET).download(path);
    expect(new Uint8Array(await data!.arrayBuffer())).toEqual(PDF);
  });

  it("the bucket refuses other file types and files over 5 MB", async () => {
    const bucket = await storage("bendahari");
    const html = await bucket.upload(`masjids/${MASJID_A}/x-${crypto.randomUUID()}.html`, new TextEncoder().encode("<p>x</p>"), {
      contentType: "text/html",
    });
    expect(html.error).not.toBeNull();
    const big = await bucket.upload(`masjids/${MASJID_A}/besar-${crypto.randomUUID()}.pdf`, new Uint8Array(5 * 1024 * 1024 + 10), {
      contentType: "application/pdf",
    });
    expect(big.error).not.toBeNull();
  });

  it("visitors who are not signed in cannot read or list", async () => {
    const bucket = anon.storage.from(BUCKET);
    expect((await bucket.download(FILE_B)).data).toBeNull();
    expect((await bucket.list(`masjids/${MASJID_B}`)).data ?? []).toEqual([]);
  });
});
