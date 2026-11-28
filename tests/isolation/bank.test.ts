import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { firstRowId, LOCKED_MONTH, masjidId, OPEN_DATE, type Role } from "../../scripts/seed-data";
import { admin, PERMISSION_DENIED, userClient } from "./helpers";

const MASJID_A = masjidId("a");
const CHECK_VIOLATION = "23514";
const LOCKED_DATE = LOCKED_MONTH.replace(/01$/, "20");

const hash = () => createHash("sha256").update(crypto.randomUUID()).digest("hex");
/** An amount no other test uses, so suggestions and matches never collide. */
const amount = () => 100_000 + Math.floor(Math.random() * 9_000_000);

type Line = { date: string; amount_sen: number; description: string; hash: string };
const newLine = (extra: Partial<Line> = {}): Line => ({ date: OPEN_DATE, amount_sen: amount(), description: "Ujian bank", hash: hash(), ...extra });

async function importLines(lines: Line[], role: Role = "bendahari") {
  return (await userClient("a", role)).rpc("import_bank_lines", { p_format_id: null, p_file_name: "ujian.csv", p_lines: lines });
}

/** Imports one line and returns its id. */
async function bankLine(extra: Partial<Line> = {}) {
  const line = newLine(extra);
  const { error } = await importLines([line]);
  expect(error).toBeNull();
  const { data } = await admin.from("bank_lines").select("id").eq("masjid_id", MASJID_A).eq("line_hash", line.hash).single();
  return { id: data!.id as string, ...line };
}

/** A ledger entry recorded by the Bendahari. */
async function ledgerEntry(sen: number, direction: "in" | "out", method = "bank_transfer", date = OPEN_DATE) {
  const client = await userClient("a", "bendahari");
  const { data, error } = await client
    .from("transactions")
    .insert({ fund_id: firstRowId("a", "funds"), amount_sen: sen, direction, date, method })
    .select("id")
    .single();
  expect(error).toBeNull();
  return data!.id as string;
}

const bendahari = () => userClient("a", "bendahari");

async function lineRow(id: string) {
  const { data } = await admin.from("bank_lines").select("*").eq("id", id).single();
  return data!;
}

describe("importing", () => {
  it("adds new lines and records the import", async () => {
    const lines = [newLine(), newLine({ amount_sen: -5_000 })];
    const { data, error } = await importLines(lines);
    expect(error).toBeNull();
    expect(data).toEqual([{ import_id: expect.any(String), added: 2, skipped: 0 }]);
    const { data: saved } = await admin.from("bank_imports").select("lines_added, lines_skipped, first_date, file_name").eq("id", data[0].import_id).single();
    expect(saved).toEqual({ lines_added: 2, lines_skipped: 0, first_date: OPEN_DATE, file_name: "ujian.csv" });
  });

  it("adds nothing the second time the same lines come in", async () => {
    const lines = [newLine(), newLine()];
    await importLines(lines);
    const { data, error } = await importLines(lines);
    expect(error).toBeNull();
    expect(data).toEqual([{ import_id: null, added: 0, skipped: 2 }]);
    const { count } = await admin.from("bank_lines").select("id", { count: "exact", head: true }).in("line_hash", lines.map((line) => line.hash));
    expect(count).toBe(2);
  });

  it("adds only the new lines of a longer statement", async () => {
    const first = [newLine()];
    await importLines(first);
    const { data } = await importLines([...first, newLine(), newLine()]);
    expect(data).toEqual([{ import_id: expect.any(String), added: 2, skipped: 1 }]);
  });

  it("refuses a line in a locked month, and adds nothing from that file", async () => {
    const open = newLine();
    const { error } = await importLines([open, newLine({ date: LOCKED_DATE })]);
    expect(error?.message).toContain("locked period");
    const { data } = await admin.from("bank_lines").select("id").eq("line_hash", open.hash);
    expect(data).toEqual([]);
  });

  it.each([
    ["no amount", { amount_sen: 0 }],
    ["a bad fingerprint", { hash: "abc" }],
    ["a long description", { description: "x".repeat(301) }],
  ])("refuses a line with %s", async (_, change) => {
    const { error } = await importLines([newLine(change)]);
    expect(error?.message).toContain("bank: a line is not valid");
  });

  it("refuses an empty list and a missing file name", async () => {
    expect((await importLines([])).error?.message).toContain("bank: no lines");
    const client = await bendahari();
    const { error } = await client.rpc("import_bank_lines", { p_format_id: null, p_file_name: " ", p_lines: [newLine()] });
    expect(error?.message).toContain("file name");
  });

  it("refuses another masjid's saved format", async () => {
    const client = await bendahari();
    const { error } = await client.rpc("import_bank_lines", { p_format_id: firstRowId("b", "bank_formats"), p_file_name: "x.csv", p_lines: [newLine()] });
    expect(error?.message).toContain("bank: format not found");
  });

  it.each(["pengerusi", "setiausaha", "ajk", "imam"] as Role[])("%s cannot import", async (role) => {
    const { error } = await importLines([newLine()], role);
    expect(error?.code).toBe(PERMISSION_DENIED);
  });

  it("puts lines in the caller's own masjid", async () => {
    const line = await bankLine();
    expect((await lineRow(line.id)).masjid_id).toBe(MASJID_A);
  });
});

describe("matching", () => {
  it("links a line to the entry with the same amount and direction", async () => {
    const line = await bankLine();
    const entry = await ledgerEntry(line.amount_sen, "in");
    const { error } = await (await bendahari()).rpc("match_bank_line", { p_line_id: line.id, p_transaction_id: entry });
    expect(error).toBeNull();
    expect((await lineRow(line.id)).matched_transaction_id).toBe(entry);
  });

  it("works for money out", async () => {
    const sen = amount();
    const line = await bankLine({ amount_sen: -sen });
    const entry = await ledgerEntry(sen, "out", "cheque");
    expect((await (await bendahari()).rpc("match_bank_line", { p_line_id: line.id, p_transaction_id: entry })).error).toBeNull();
  });

  it("refuses a different amount or the wrong direction", async () => {
    const line = await bankLine();
    const client = await bendahari();
    for (const entry of [await ledgerEntry(line.amount_sen + 1, "in"), await ledgerEntry(line.amount_sen, "out")]) {
      const { error } = await client.rpc("match_bank_line", { p_line_id: line.id, p_transaction_id: entry });
      expect(error?.message).toContain("bank: amount does not match");
    }
  });

  it("refuses a cash entry", async () => {
    const line = await bankLine();
    const entry = await ledgerEntry(line.amount_sen, "in", "cash");
    const { error } = await (await bendahari()).rpc("match_bank_line", { p_line_id: line.id, p_transaction_id: entry });
    expect(error?.message).toContain("bank: cash entries do not go through the bank");
  });

  it("refuses a cancelled entry and its cancellation", async () => {
    const line = await bankLine();
    const entry = await ledgerEntry(line.amount_sen, "in");
    const client = await bendahari();
    const { data: reversal } = await client
      .from("transactions")
      .insert({ reverses_id: entry, fund_id: firstRowId("a", "funds"), amount_sen: line.amount_sen, direction: "out", date: OPEN_DATE, method: "bank_transfer", reversal_reason: "Ujian" })
      .select("id")
      .single();
    for (const id of [entry, reversal!.id]) {
      const { error } = await client.rpc("match_bank_line", { p_line_id: line.id, p_transaction_id: id });
      expect(error?.message).toMatch(/entry is cancelled|amount does not match/);
    }
  });

  it("uses each entry and each line once", async () => {
    const first = await bankLine();
    const second = await bankLine({ amount_sen: first.amount_sen });
    const entry = await ledgerEntry(first.amount_sen, "in");
    const other = await ledgerEntry(first.amount_sen, "in");
    const client = await bendahari();
    expect((await client.rpc("match_bank_line", { p_line_id: first.id, p_transaction_id: entry })).error).toBeNull();
    expect((await client.rpc("match_bank_line", { p_line_id: second.id, p_transaction_id: entry })).error?.message).toContain("bank: entry already matched");
    expect((await client.rpc("match_bank_line", { p_line_id: first.id, p_transaction_id: other })).error?.message).toContain("bank: line already explained");
  });

  it("is removed by itself when the entry is cancelled", async () => {
    const line = await bankLine();
    const entry = await ledgerEntry(line.amount_sen, "in");
    const client = await bendahari();
    await client.rpc("match_bank_line", { p_line_id: line.id, p_transaction_id: entry });
    await client
      .from("transactions")
      .insert({ reverses_id: entry, fund_id: firstRowId("a", "funds"), amount_sen: line.amount_sen, direction: "out", date: OPEN_DATE, method: "bank_transfer", reversal_reason: "Salah dana" });
    expect((await lineRow(line.id)).matched_transaction_id).toBeNull();
  });

  it("can be undone", async () => {
    const line = await bankLine();
    const entry = await ledgerEntry(line.amount_sen, "in");
    const client = await bendahari();
    await client.rpc("match_bank_line", { p_line_id: line.id, p_transaction_id: entry });
    expect((await client.rpc("clear_bank_line", { p_line_id: line.id })).error).toBeNull();
    expect((await lineRow(line.id)).matched_transaction_id).toBeNull();
    expect((await client.rpc("clear_bank_line", { p_line_id: line.id })).error?.message).toContain("not explained");
  });

  it.each(["pengerusi", "setiausaha", "ajk", "imam"] as Role[])("%s cannot match, mark or undo", async (role) => {
    const line = await bankLine();
    const entry = await ledgerEntry(line.amount_sen, "in");
    const client = await userClient("a", role);
    for (const [fn, args] of [
      ["match_bank_line", { p_line_id: line.id, p_transaction_id: entry }],
      ["mark_bank_cash", { p_line_id: line.id }],
      ["clear_bank_line", { p_line_id: line.id }],
      ["reject_bank_suggestion", { p_line_id: line.id, p_transaction_id: entry }],
    ] as const) {
      expect((await client.rpc(fn, args)).error?.code, fn).toBe(PERMISSION_DENIED);
    }
    expect((await lineRow(line.id)).matched_transaction_id).toBeNull();
  });

  it("is written to the audit log without the description", async () => {
    const line = await bankLine({ description: "PENDERMA NAMA RAHSIA" });
    const entry = await ledgerEntry(line.amount_sen, "in");
    await (await bendahari()).rpc("match_bank_line", { p_line_id: line.id, p_transaction_id: entry });
    const { data } = await admin.from("audit_log").select("action, before, after").eq("row_id", line.id).order("at");
    expect(data!.map((row) => row.action)).toEqual(["INSERT", "UPDATE"]);
    expect(JSON.stringify(data)).not.toContain("RAHSIA");
    expect(data![1].after.matched_transaction_id).toBe(entry);
  });
});

describe("cash deposits and rejected suggestions", () => {
  it("marks a line as cash, and not while it is matched", async () => {
    const line = await bankLine();
    const client = await bendahari();
    expect((await client.rpc("mark_bank_cash", { p_line_id: line.id })).error).toBeNull();
    expect((await lineRow(line.id)).cash_transfer).toBe(true);
    const entry = await ledgerEntry(line.amount_sen, "in");
    expect((await client.rpc("match_bank_line", { p_line_id: line.id, p_transaction_id: entry })).error?.message).toContain("already explained");
  });

  it("never lets a line be both matched and cash", async () => {
    const line = await bankLine();
    const entry = await ledgerEntry(line.amount_sen, "in");
    await (await bendahari()).rpc("match_bank_line", { p_line_id: line.id, p_transaction_id: entry });
    const { error } = await admin.from("bank_lines").update({ cash_transfer: true }).eq("id", line.id);
    expect(error?.code).toBe(CHECK_VIOLATION);
  });

  it("remembers a rejected suggestion once", async () => {
    const line = await bankLine();
    const entry = await ledgerEntry(line.amount_sen, "in");
    const client = await bendahari();
    await client.rpc("reject_bank_suggestion", { p_line_id: line.id, p_transaction_id: entry });
    await client.rpc("reject_bank_suggestion", { p_line_id: line.id, p_transaction_id: entry });
    expect((await lineRow(line.id)).rejected_ids).toEqual([entry]);
    // Matching it by hand afterwards is still allowed, and forgets the rejection.
    await client.rpc("match_bank_line", { p_line_id: line.id, p_transaction_id: entry });
    expect((await lineRow(line.id)).rejected_ids).toEqual([]);
  });

  it("cannot mark a line in a locked month", async () => {
    const { data } = await admin.from("bank_lines").select("id").eq("masjid_id", MASJID_A).eq("date", "2026-09-16").single();
    const { error } = await (await bendahari()).rpc("mark_bank_cash", { p_line_id: data!.id });
    expect(error?.message).toContain("locked period");
  });
});

describe("cancelling an import", () => {
  async function fileOf(lines: Line[]) {
    const { data } = await importLines(lines);
    return data[0].import_id as string;
  }

  it("takes its lines out, and they can be imported again", async () => {
    const lines = [newLine(), newLine()];
    const id = await fileOf(lines);
    const client = await bendahari();
    expect((await client.rpc("cancel_bank_import", { p_import_id: id })).error).toBeNull();
    const { data: left } = await admin.from("bank_lines").select("id").eq("import_id", id);
    expect(left).toEqual([]);
    const { data: record } = await admin.from("bank_imports").select("cancelled_at, cancelled_by").eq("id", id).single();
    expect(record!.cancelled_at).not.toBeNull();
    expect((await client.rpc("cancel_bank_import", { p_import_id: id })).error?.message).toContain("already cancelled");
    expect((await importLines(lines)).data[0].added).toBe(2);
  });

  it("is refused once a line is matched or marked", async () => {
    const line = newLine();
    const id = await fileOf([line]);
    const client = await bendahari();
    const { data: saved } = await admin.from("bank_lines").select("id").eq("import_id", id).single();
    await client.rpc("mark_bank_cash", { p_line_id: saved!.id });
    expect((await client.rpc("cancel_bank_import", { p_import_id: id })).error?.message).toContain("bank: import has matched lines");
  });

  it.each(["pengerusi", "setiausaha"] as Role[])("%s cannot cancel", async (role) => {
    const id = await fileOf([newLine()]);
    expect((await (await userClient("a", role)).rpc("cancel_bank_import", { p_import_id: id })).error?.code).toBe(PERMISSION_DENIED);
  });
});

describe("saved bank formats", () => {
  const format = () => ({ name: `Bank ${crypto.randomUUID().slice(0, 8)}`, date_column: "Tarikh", description_columns: ["Keterangan"], debit_column: "Debit", credit_column: "Kredit" });

  it("need either one amount column or both debit and credit", async () => {
    const client = await bendahari();
    expect((await client.from("bank_formats").insert(format())).error).toBeNull();
    expect((await client.from("bank_formats").insert({ ...format(), credit_column: null })).error?.code).toBe(CHECK_VIOLATION);
    expect((await client.from("bank_formats").insert({ ...format(), amount_column: "Amaun" })).error?.code).toBe(CHECK_VIOLATION);
  });

  it("Pengerusi can see them but not change them", async () => {
    const client = await userClient("a", "pengerusi");
    const { data } = await client.from("bank_formats").select("id").eq("id", firstRowId("a", "bank_formats"));
    expect(data).toHaveLength(1);
    const { data: changed } = await client.from("bank_formats").update({ name: "ubah" }).eq("id", firstRowId("a", "bank_formats")).select();
    expect(changed ?? []).toEqual([]);
  });
});

describe("DuitNow settings", () => {
  it("Pengerusi can turn the receipt QR on and off", async () => {
    const client = await userClient("a", "pengerusi");
    const { data, error } = await client.from("masjids").update({ receipt_show_qr: false }).eq("id", MASJID_A).select("receipt_show_qr");
    expect(error).toBeNull();
    expect(data).toEqual([{ receipt_show_qr: false }]);
  });

  it.each(["bendahari", "setiausaha", "ajk", "imam"] as Role[])("%s cannot change the QR", async (role) => {
    const client = await userClient("a", role);
    const { data, error } = await client.from("masjids").update({ duitnow_payload: "000201".padEnd(40, "0") }).eq("id", MASJID_A).select();
    if (error) expect(error.code).toBe(PERMISSION_DENIED);
    else expect(data).toEqual([]);
  });

  it("refuses QR text that is too short or too long", async () => {
    for (const payload of ["0002", "0".repeat(513)]) {
      const { error } = await admin.from("masjids").update({ duitnow_payload: payload }).eq("id", MASJID_A);
      expect(error?.code).toBe(CHECK_VIOLATION);
    }
  });
});
