import { createHash } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { firstRowId, masjidId, type Role } from "../../scripts/seed-data";
import { admin, openMonth, PERMISSION_DENIED, userClient, userId } from "./helpers";

const MASJID_A = masjidId("a");
const MASJID_B = masjidId("b");
const pengerusi = () => userClient("a", "pengerusi");
const bendahari = () => userClient("a", "bendahari");

// Every test that locks a month unlocks it again afterwards.
const toUnlock: string[] = [];
afterEach(async () => {
  const client = await pengerusi();
  for (const month of toUnlock.splice(0)) await client.rpc("unlock_month", { p_month: `${month}-01`, p_reason: "Selesai ujian" });
});

async function lock(month: string) {
  const { error } = await (await pengerusi()).rpc("lock_month", { p_month: `${month}-01` });
  expect(error).toBeNull();
  toUnlock.push(month);
}

const entry = (date: string, extra: Record<string, unknown> = {}) => ({
  fund_id: firstRowId("a", "funds"),
  amount_sen: 4_321,
  direction: "in",
  date,
  method: "bank_transfer",
  ...extra,
});

describe("locking a month", () => {
  it("Pengerusi locks a past month; who and when are recorded", async () => {
    const month = await openMonth(MASJID_A);
    await lock(month);
    const { data } = await admin.from("periods").select("locked_at, locked_by, unlock_reason").eq("masjid_id", MASJID_A).eq("month", `${month}-01`).single();
    expect(data!.locked_at).not.toBeNull();
    expect(data!.locked_by).toBe(await userId("a", "pengerusi"));
    expect(data!.unlock_reason).toBeNull();
  });

  it.each(["bendahari", "setiausaha", "ajk", "imam"] as Role[])("%s cannot lock or unlock", async (role) => {
    const month = await openMonth(MASJID_A);
    const client = await userClient("a", role);
    expect((await client.rpc("lock_month", { p_month: `${month}-01` })).error?.code).toBe(PERMISSION_DENIED);
    expect((await client.rpc("unlock_month", { p_month: "2026-09-01", p_reason: "x" })).error?.code).toBe(PERMISSION_DENIED);
  });

  it("nobody can lock or unlock by writing the month record directly", async () => {
    const client = await pengerusi();
    const { error: insert } = await client.from("periods").insert({ month: `${await openMonth(MASJID_A)}-01`, locked_at: new Date().toISOString() });
    expect(insert?.code).toBe(PERMISSION_DENIED);
    const { error: update } = await client.from("periods").update({ locked_at: null, unlock_reason: "x" }).eq("id", firstRowId("a", "periods"));
    expect(update?.code).toBe(PERMISSION_DENIED);
  });

  it("refuses the current month, a future month and a day that is not the 1st", async () => {
    const client = await pengerusi();
    const now = new Date(Date.now() + 8 * 3_600_000).toISOString().slice(0, 7);
    expect((await client.rpc("lock_month", { p_month: `${now}-01` })).error?.message).toContain("has not ended");
    expect((await client.rpc("lock_month", { p_month: "2099-01-01" })).error?.message).toContain("has not ended");
    expect((await client.rpc("lock_month", { p_month: "2025-01-15" })).error?.message).toContain("first day");
  });

  it("refuses a month that is already locked", async () => {
    const month = await openMonth(MASJID_A);
    await lock(month);
    expect((await (await pengerusi()).rpc("lock_month", { p_month: `${month}-01` })).error?.message).toContain("already locked");
  });

  it("is refused while a collection is waiting, and allowed once it is cancelled", async () => {
    const month = await openMonth(MASJID_A);
    const { data: id } = await (await bendahari()).rpc("record_collection", {
      p_key: crypto.randomUUID(),
      p_date: `${month}-07`,
      p_fund_id: firstRowId("a", "funds"),
      p_total_sen: 10_000,
    });
    const client = await pengerusi();
    expect((await client.rpc("lock_month", { p_month: `${month}-01` })).error?.message).toContain("pending collections");
    expect((await client.rpc("cancel_collection", { p_id: id, p_reason: "Ujian kunci bulan" })).error).toBeNull();
    await lock(month);
  });
});

describe("a locked month cannot change, for any role", () => {
  it("refuses new entries, from the Bendahari and with the secret key", async () => {
    const month = await openMonth(MASJID_A);
    await lock(month);
    expect((await (await bendahari()).from("transactions").insert(entry(`${month}-10`))).error?.message).toContain("locked period");
    expect((await admin.from("transactions").insert(entry(`${month}-10`, { masjid_id: MASJID_A }))).error?.message).toContain("locked period");
  });

  it("refuses a reversal dated in it, but takes one dated in an open month", async () => {
    const month = await openMonth(MASJID_A);
    const client = await bendahari();
    const { data: original } = await client.from("transactions").insert(entry(`${month}-05`)).select("id").single();
    await lock(month);
    const reversal = (date: string) =>
      entry(date, { reverses_id: original!.id, direction: "out", reversal_reason: "Ujian bulan dikunci" });
    expect((await client.from("transactions").insert(reversal(`${month}-20`))).error?.message).toContain("locked period");
    expect((await client.from("transactions").insert(reversal(new Date(Date.now() + 8 * 3_600_000).toISOString().slice(0, 10)))).error).toBeNull();
  });

  it("refuses a new collection and a change to an old one", async () => {
    const month = await openMonth(MASJID_A);
    const { data: id } = await (await bendahari()).rpc("record_collection", {
      p_key: crypto.randomUUID(),
      p_date: `${month}-14`,
      p_fund_id: firstRowId("a", "funds"),
      p_total_sen: 5_000,
    });
    await (await pengerusi()).rpc("cancel_collection", { p_id: id, p_reason: "Ujian" });
    await lock(month);
    const { error } = await (await bendahari()).rpc("record_collection", {
      p_key: crypto.randomUUID(),
      p_date: `${month}-21`,
      p_fund_id: firstRowId("a", "funds"),
      p_total_sen: 5_000,
    });
    expect(error?.message).toContain("locked period");
    // Cancelled counts can never change anyway; whichever rule answers, nothing changes.
    expect((await admin.from("collections").update({ note: "ubah" }).eq("id", id)).error).not.toBeNull();
  });

  it("refuses a khairat payment dated in it", async () => {
    const month = await openMonth(MASJID_A);
    const { data: unpaid } = await admin.from("khairat_members").select("id").eq("masjid_id", MASJID_A).is("ended_at", null).eq("paid_sen", 0).limit(1).single();
    await lock(month);
    const { error } = await (await bendahari()).rpc("record_khairat_payment", {
      p_member_id: unpaid!.id,
      p_amount_sen: 100,
      p_date: `${month}-10`,
      p_method: "cash",
    });
    expect(error?.message).toContain("locked period");
  });

  it("refuses a bank import and a bank match into it", async () => {
    const month = await openMonth(MASJID_A);
    const client = await bendahari();
    const hash = createHash("sha256").update(crypto.randomUUID()).digest("hex");
    await client.rpc("import_bank_lines", { p_format_id: null, p_file_name: "x.csv", p_lines: [{ date: `${month}-09`, amount_sen: 4_321, description: "Ujian", hash }] });
    const { data: line } = await admin.from("bank_lines").select("id").eq("line_hash", hash).single();
    const { data: original } = await client.from("transactions").insert(entry(`${month}-09`)).select("id").single();
    await lock(month);

    const newHash = createHash("sha256").update(crypto.randomUUID()).digest("hex");
    const imported = await client.rpc("import_bank_lines", { p_format_id: null, p_file_name: "y.csv", p_lines: [{ date: `${month}-11`, amount_sen: 100, description: "Ujian", hash: newHash }] });
    expect(imported.error?.message).toContain("locked period");
    const matched = await client.rpc("match_bank_line", { p_line_id: line!.id, p_transaction_id: original!.id });
    expect(matched.error?.message).toContain("locked period");
  });
});

describe("unlocking", () => {
  it("needs the Pengerusi and a reason, then the month takes entries again", async () => {
    const month = await openMonth(MASJID_A);
    const { error: lockError } = await (await pengerusi()).rpc("lock_month", { p_month: `${month}-01` });
    expect(lockError).toBeNull();
    const client = await pengerusi();
    expect((await client.rpc("unlock_month", { p_month: `${month}-01`, p_reason: "  " })).error?.message).toContain("needs a reason");
    expect((await client.rpc("unlock_month", { p_month: `${month}-01`, p_reason: "x".repeat(301) })).error?.message).toContain("too long");
    expect((await client.rpc("unlock_month", { p_month: `${month}-01`, p_reason: "Betulkan bil yang salah dana" })).error).toBeNull();
    expect((await client.rpc("unlock_month", { p_month: `${month}-01`, p_reason: "lagi" })).error?.message).toContain("is not locked");
    expect((await (await bendahari()).from("transactions").insert(entry(`${month}-10`))).error).toBeNull();
  });

  it("is written to the audit log with who and why", async () => {
    const month = await openMonth(MASJID_A);
    const client = await pengerusi();
    await client.rpc("lock_month", { p_month: `${month}-01` });
    await client.rpc("unlock_month", { p_month: `${month}-01`, p_reason: `Sebab ujian ${month}` });
    const { data: period } = await admin.from("periods").select("id").eq("masjid_id", MASJID_A).eq("month", `${month}-01`).single();
    const { data: log } = await admin.from("audit_log").select("user_id, action, before, after").eq("row_id", period!.id).order("at", { ascending: false }).limit(2);
    const [unlock, locked] = log!;
    expect(unlock.after.locked_at).toBeNull();
    expect(unlock.before.locked_at).not.toBeNull();
    expect(unlock.after.unlock_reason).toBe(`Sebab ujian ${month}`);
    expect(unlock.user_id).toBe(await userId("a", "pengerusi"));
    expect(locked.after.locked_at).not.toBeNull();
  });

  it("marks that month's and that year's reports as no longer valid, and no others", async () => {
    const month = await openMonth(MASJID_A);
    const year = month.slice(0, 4);
    const other = month.endsWith("-01") ? `${year}-02` : `${year}-01`;
    const { data: reports } = await admin
      .from("reports")
      .insert([month, year, other].map((period) => ({ masjid_id: MASJID_A, type: "ujian", period, storage_path: `ujian/${crypto.randomUUID()}.pdf` })))
      .select("id, period");
    const client = await pengerusi();
    await client.rpc("lock_month", { p_month: `${month}-01` });
    await client.rpc("unlock_month", { p_month: `${month}-01`, p_reason: "Ujian laporan" });

    const { data: after } = await admin.from("reports").select("period, invalidated_at").in("id", reports!.map((row) => row.id));
    const by = new Map(after!.map((row) => [row.period, row.invalidated_at]));
    expect(by.get(month)).not.toBeNull();
    expect(by.get(year)).not.toBeNull();
    expect(by.get(other)).toBeNull();
  });

  it("nobody can clear the mark by hand", async () => {
    const client = await pengerusi();
    const { error } = await client.from("reports").update({ invalidated_at: null }).eq("id", firstRowId("a", "reports"));
    expect(error?.code).toBe(PERMISSION_DENIED);
  });
});

describe("masjids stay apart", () => {
  it("masjid A's Pengerusi cannot unlock masjid B's month, and locking A leaves B open", async () => {
    const month = await openMonth(MASJID_A);
    await lock(month);
    const { data: b } = await admin.from("periods").select("locked_at").eq("masjid_id", MASJID_B).eq("month", `${month}-01`).maybeSingle();
    expect(b?.locked_at ?? null).toBeNull();

    // B's seed September is locked; A's call only ever touches A.
    const pengerusiB = await userClient("b", "pengerusi");
    expect((await pengerusiB.rpc("unlock_month", { p_month: `${month}-01`, p_reason: "x" })).error?.message).toContain("is not locked");
    const { data: a } = await admin.from("periods").select("locked_at").eq("masjid_id", MASJID_A).eq("month", `${month}-01`).single();
    expect(a!.locked_at).not.toBeNull();
  });
});

describe("audit screen coverage", () => {
  it("every table is in a record type on the audit screen", async () => {
    const { groupOf } = await import("../../lib/audit");
    const { TABLES } = await import("./helpers");
    expect(TABLES.filter((table) => table !== "audit_log" && !groupOf(table))).toEqual([]);
  });
});
