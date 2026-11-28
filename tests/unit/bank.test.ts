import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  checkFormat,
  findHeaderRow,
  fingerprints,
  guessHeaderRow,
  parseBankAmount,
  parseBankDate,
  readBankLines,
  type BankFormat,
  type FormatInput,
} from "@/lib/bank-import";
import { candidatesFor, reconcile, shiftDate, suggestMatches, type BankRow, type LedgerRow } from "@/lib/bank-matching";
import { decodeCsv, parseCsv } from "@/lib/csv";
import { checkDuitNow, crc16 } from "@/lib/duitnow";

const sha256 = (text: string) => createHash("sha256").update(text, "utf8").digest("hex");
const fixture = (name: string) => parseCsv(decodeCsv(readFileSync(path.join(__dirname, "..", "fixtures", name))));

describe("parseBankDate", () => {
  it.each([
    ["05/11/2026", "2026-11-05"],
    ["5-11-26", "2026-11-05"],
    ["05.11.2026", "2026-11-05"],
    ["2026-11-05", "2026-11-05"],
    ["05 Nov 2026", "2026-11-05"],
    ["05-NOV-26", "2026-11-05"],
    ["05Nov2026", "2026-11-05"],
    ["5 Dis 2026", "2026-12-05"],
    ["5 Ogos 2026", "2026-08-05"],
    ["05/11/2026 14:30", "2026-11-05"],
    ["05 Nov 2026 02:30 PM", "2026-11-05"],
    ["05112026", "2026-11-05"],
  ])("%s", (input, expected) => {
    expect(parseBankDate(input)).toBe(expected);
  });

  it("follows the chosen order for numeric dates", () => {
    expect(parseBankDate("11/05/2026", "mdy")).toBe("2026-11-05");
    expect(parseBankDate("2026/11/05", "ymd")).toBe("2026-11-05");
  });

  it.each(["31/02/2026", "32 Oct 2026", "Total", "", "13/13/2026", "05 Abc 2026"])("refuses %j", (input) => {
    expect(parseBankDate(input)).toBeNull();
  });
});

describe("parseBankAmount", () => {
  it.each([
    ["1,234.50", 123_450],
    ["RM 1,234.50", 123_450],
    ["1234.5", 123_450],
    ["-50.00", -5_000],
    ["(50.00)", -5_000],
    ["50.00 DR", -5_000],
    ["50.00 CR", 5_000],
    ["50.00-", -5_000],
    ["+50", 5_000],
    ["0.01", 1],
    ["", 0],
    ["-", 0],
  ])("%j is %i sen", (input, sen) => {
    expect(parseBankAmount(input)).toBe(sen);
  });

  it("never goes through a float", () => {
    expect(parseBankAmount("0.29")).toBe(29);
    expect(parseBankAmount("1,000,000.07")).toBe(100_000_007);
  });

  it.each(["abc", "1,23.00", "1.234", "12.3.4", "RM x", "99999999999.00"])("refuses %j", (input) => {
    expect(parseBankAmount(input)).toBeNull();
  });
});

const splitFormat: BankFormat = {
  date_column: "Tarikh",
  description_columns: ["Keterangan", "Rujukan"],
  debit_column: "Debit",
  credit_column: "Kredit",
  amount_column: null,
  date_order: "dmy",
};

const singleFormat: BankFormat = {
  date_column: "Date",
  description_columns: ["Description"],
  debit_column: null,
  credit_column: null,
  amount_column: "Amount (RM)",
  date_order: "dmy",
};

describe("bank format 1: debit and credit columns, details above the header", () => {
  const rows = fixture("bank-contoh-debit-kredit.csv");

  it("finds the header row under the account details", () => {
    expect(guessHeaderRow(rows)).toBe(4);
    expect(findHeaderRow(rows, splitFormat)).toBe(4);
  });

  it("reads every money line and skips the balance and total lines", () => {
    const parsed = readBankLines(rows, splitFormat);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.problems).toEqual([]);
    expect(parsed.lines.map((line) => [line.date, line.amount_sen, line.description])).toEqual([
      ["2026-10-03", 15_000, "DUITNOW TRANSFER PENDERMA CONTOH 1"],
      ["2026-10-05", -123_450, "BIL ELEKTRIK TNB REF 889911"],
      ["2026-10-05", 5_000, "DUITNOW TRANSFER PENDERMA CONTOH 2"],
      ["2026-10-05", 5_000, "DUITNOW TRANSFER PENDERMA CONTOH 2"],
      ["2026-10-12", 142_050, "DEPOSIT TUNAI CDM 0012"],
      ["2026-10-31", -50, "CAJ PERKHIDMATAN"],
    ]);
  });

  it("matches header names without case or extra spaces", () => {
    const format = { ...splitFormat, date_column: " tarikh ", debit_column: "DEBIT" };
    expect(findHeaderRow(rows, format)).toBe(4);
  });

  it("says when the saved columns are not in the file", () => {
    expect(readBankLines(rows, singleFormat)).toEqual({ ok: false, error: "bank_header_missing" });
  });

  it("refuses a line with money on both sides", () => {
    const csv = parseCsv("Tarikh,Keterangan,Rujukan,Debit,Kredit\n01/10/2026,X,,5.00,6.00\n02/10/2026,Y,,1.00,\n");
    const parsed = readBankLines(csv, splitFormat);
    expect(parsed.ok && parsed.problems).toEqual([{ line: 2, error: "bank_both_sides" }]);
    expect(parsed.ok && parsed.lines.length).toBe(1);
  });
});

describe("bank format 2: one signed amount column, named months", () => {
  const rows = fixture("bank-contoh-satu-lajur.csv");

  it("reads signs written as minus, CR and brackets, and dates with times", () => {
    expect(guessHeaderRow(rows)).toBe(0);
    const parsed = readBankLines(rows, singleFormat);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.lines.map((line) => [line.date, line.amount_sen])).toEqual([
      ["2026-10-03", 15_000],
      ["2026-10-05", -123_450],
      ["2026-10-12", 142_050],
      ["2026-10-31", -50],
    ]);
  });

  it("points to the line number of a date it cannot read", () => {
    const parsed = readBankLines(rows, singleFormat);
    expect(parsed.ok && parsed.problems).toEqual([{ line: 7, error: "bank_date_bad" }]);
  });

  it("reports a file with nothing to import", () => {
    expect(readBankLines(parseCsv("Date,Description,Amount (RM)\n02/10/2026,Opening,0.00\n"), singleFormat)).toEqual({
      ok: false,
      error: "bank_no_lines",
    });
  });
});

describe("duplicate fingerprints", () => {
  const lines = [
    { date: "2026-10-05", amount_sen: 5_000, description: "DUITNOW  Penderma" },
    { date: "2026-10-05", amount_sen: 5_000, description: "duitnow penderma" },
    { date: "2026-10-05", amount_sen: -5_000, description: "duitnow penderma" },
  ];

  it("are the same every time the same file is read", () => {
    expect(fingerprints(lines, sha256)).toEqual(fingerprints(lines, sha256));
  });

  it("keep two identical payments on one day apart", () => {
    const [a, b, c] = fingerprints(lines, sha256);
    expect(a).not.toBe(b);
    expect(new Set([a, b, c]).size).toBe(3);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });

  it("do not change when a later statement repeats the same lines", () => {
    const first = fingerprints(lines.slice(0, 2), sha256);
    const again = fingerprints([...lines.slice(0, 2), { date: "2026-10-06", amount_sen: 1, description: "baru" }], sha256);
    expect(again.slice(0, 2)).toEqual(first);
  });

  it("ignore case and extra spaces in the description", () => {
    expect(fingerprints([lines[0]], sha256)).toEqual(fingerprints([{ ...lines[0], description: "duitnow penderma" }], sha256));
  });
});

describe("checkFormat", () => {
  const base: FormatInput = {
    name: " Maybank ",
    date_column: "Tarikh",
    description_1: "Keterangan",
    description_2: "",
    kind: "split",
    debit_column: "Debit",
    credit_column: "Kredit",
    amount_column: "",
    date_order: "dmy",
  };

  it("accepts debit and credit columns", () => {
    expect(checkFormat(base)).toEqual({
      ok: true,
      name: "Maybank",
      format: { date_column: "Tarikh", description_columns: ["Keterangan"], debit_column: "Debit", credit_column: "Kredit", amount_column: null, date_order: "dmy" },
    });
  });

  it("accepts one amount column and drops the other two", () => {
    const check = checkFormat({ ...base, kind: "single", amount_column: "Amaun" });
    expect(check.ok && check.format).toMatchObject({ amount_column: "Amaun", debit_column: null, credit_column: null });
  });

  it.each([
    [{ name: "" }, "bank_format_name_missing"],
    [{ name: "x".repeat(61) }, "bank_format_name_too_long"],
    [{ date_column: "" }, "bank_column_missing"],
    [{ credit_column: "" }, "bank_column_missing"],
    [{ credit_column: "Debit" }, "bank_columns_same"],
    [{ kind: "single" }, "bank_column_missing"],
    [{ date_order: "xyz" }, "bank_column_missing"],
  ] as [Partial<FormatInput>, string][])("refuses %j", (change, error) => {
    expect(checkFormat({ ...base, ...change })).toEqual({ ok: false, error });
  });
});

// Built like a real DuitNow QR, with a fake account.
const tlv = (id: string, value: string) => `${id}${`${value.length}`.padStart(2, "0")}${value}`;
function duitNow(name = "MASJID CONTOH", country = "MY") {
  const body =
    tlv("00", "01") +
    tlv("01", "11") +
    tlv("26", tlv("00", "A0000006150001") + tlv("01", "0000000")) +
    tlv("52", "0000") +
    tlv("53", "458") +
    tlv("58", country) +
    tlv("59", name) +
    tlv("60", "KAJANG") +
    "6304";
  return body + crc16(body);
}

describe("checkDuitNow", () => {
  it("reads the account name from a good QR", () => {
    expect(checkDuitNow(` ${duitNow()} `)).toEqual({ ok: true, payload: duitNow(), name: "MASJID CONTOH", city: "KAJANG" });
  });

  it("checks the standard checksum", () => {
    expect(crc16("123456789")).toBe("29B1");
  });

  it("refuses a QR with a typo, so a wrong account is never shown", () => {
    const good = duitNow();
    expect(checkDuitNow(good.replace("CONTOH", "CONTOX")).ok).toBe(false);
    expect(checkDuitNow(good.replace("CONTOH", "CONTOX"))).toEqual({ ok: false, error: "duitnow_damaged" });
  });

  it.each([
    ["", "duitnow_missing"],
    ["https://example.com/pay", "duitnow_bad"],
    ["0002010102116304ABCD", "duitnow_damaged"],
    ["000201010211999", "duitnow_bad"],
  ])("refuses %j", (input, error) => {
    expect(checkDuitNow(input)).toEqual({ ok: false, error });
  });

  it("refuses a QR from another country", () => {
    expect(checkDuitNow(duitNow("MASJID CONTOH", "SG"))).toEqual({ ok: false, error: "duitnow_not_malaysia" });
  });

  it("refuses very long text", () => {
    expect(checkDuitNow(`000201${"9".repeat(600)}`)).toEqual({ ok: false, error: "duitnow_too_long" });
  });
});

// Matching ----------------------------------------------------------------------------

const line = (id: string, date: string, amount_sen: number, extra: Partial<BankRow> = {}): BankRow => ({
  id,
  date,
  amount_sen,
  description: id,
  matched_transaction_id: null,
  cash_transfer: false,
  rejected_ids: [],
  ...extra,
});
const entry = (id: string, date: string, amount_sen: number, direction: "in" | "out", extra: Partial<LedgerRow> = {}): LedgerRow => ({
  id,
  date,
  amount_sen,
  direction,
  method: "bank_transfer",
  reverses_id: null,
  reversed: false,
  ...extra,
});

describe("suggestMatches", () => {
  it("pairs the same amount and direction within three days", () => {
    const lines = [line("L1", "2026-10-10", 5_000), line("L2", "2026-10-10", -2_000)];
    const entries = [entry("E1", "2026-10-13", 5_000, "in"), entry("E2", "2026-10-07", 2_000, "out")];
    expect(suggestMatches(lines, entries, new Set())).toEqual(new Map([["L1", "E1"], ["L2", "E2"]]));
  });

  it("does not pair across four days, or the wrong direction, or a different amount", () => {
    const lines = [line("L1", "2026-10-10", 5_000)];
    expect(suggestMatches(lines, [entry("E1", "2026-10-14", 5_000, "in")], new Set()).size).toBe(0);
    expect(suggestMatches(lines, [entry("E1", "2026-10-10", 5_000, "out")], new Set()).size).toBe(0);
    expect(suggestMatches(lines, [entry("E1", "2026-10-10", 5_001, "in")], new Set()).size).toBe(0);
  });

  it("never suggests cash, cancelled, cancelling or taken entries", () => {
    const lines = [line("L1", "2026-10-10", 5_000)];
    const blocked = [
      entry("E1", "2026-10-10", 5_000, "in", { method: "cash" }),
      entry("E2", "2026-10-10", 5_000, "in", { reversed: true }),
      entry("E3", "2026-10-10", 5_000, "in", { reverses_id: "E9" }),
      entry("E4", "2026-10-10", 5_000, "in"),
    ];
    expect(suggestMatches(lines, blocked, new Set(["E4"])).size).toBe(0);
  });

  it("does not suggest an entry the Bendahari turned down for that line", () => {
    const lines = [line("L1", "2026-10-10", 5_000, { rejected_ids: ["E1"] })];
    const entries = [entry("E1", "2026-10-10", 5_000, "in"), entry("E2", "2026-10-12", 5_000, "in")];
    expect(suggestMatches(lines, entries, new Set())).toEqual(new Map([["L1", "E2"]]));
  });

  it("gives each entry to one line, closest dates first", () => {
    const lines = [line("L1", "2026-10-10", 5_000), line("L2", "2026-10-12", 5_000)];
    const entries = [entry("E1", "2026-10-12", 5_000, "in"), entry("E2", "2026-10-09", 5_000, "in")];
    expect(suggestMatches(lines, entries, new Set())).toEqual(new Map([["L2", "E1"], ["L1", "E2"]]));
  });

  it("leaves lines already matched or marked as cash alone", () => {
    const lines = [line("L1", "2026-10-10", 5_000, { matched_transaction_id: "E0" }), line("L2", "2026-10-10", 5_000, { cash_transfer: true })];
    expect(suggestMatches(lines, [entry("E1", "2026-10-10", 5_000, "in")], new Set()).size).toBe(0);
  });
});

describe("candidatesFor", () => {
  it("lists same-amount entries at any date, closest first", () => {
    const entries = [entry("Far", "2026-01-01", 5_000, "in"), entry("Near", "2026-10-01", 5_000, "in"), entry("Other", "2026-10-10", 4_000, "in")];
    expect(candidatesFor(line("L", "2026-10-10", 5_000), entries, new Set()).map((e) => e.id)).toEqual(["Near", "Far"]);
  });
});

describe("reconcile", () => {
  const month = "2026-10";
  const entries = [
    entry("E1", "2026-10-03", 15_000, "in"),
    entry("E2", "2026-10-05", 123_450, "out"),
    entry("Cash", "2026-10-09", 142_050, "in", { method: "cash" }),
    entry("Late", "2026-10-30", 2_000, "in"),
  ];

  it("is zero when every line is matched or marked as cash", () => {
    const lines = [
      line("L1", "2026-10-03", 15_000, { matched_transaction_id: "E1" }),
      line("L2", "2026-10-05", -123_450, { matched_transaction_id: "E2" }),
      line("L3", "2026-10-12", 142_050, { cash_transfer: true }),
      line("L4", "2026-10-30", 2_000, { matched_transaction_id: "Late" }),
    ];
    const matchedBy = new Map([["E1", "2026-10-03"], ["E2", "2026-10-05"], ["Late", "2026-10-30"]]);
    const dates = new Map(entries.map((e) => [e.id, { date: e.date, cancelled: false }]));
    const r = reconcile(month, lines, entries, matchedBy, dates);
    expect(r.bank_sen).toBe(15_000 - 123_450 + 142_050 + 2_000);
    expect(r.entries_sen).toBe(15_000 - 123_450 + 2_000);
    expect(r.cash_sen).toBe(142_050);
    expect(r.difference_sen).toBe(0);
    expect(r.unmatchedLines).toEqual([]);
    expect(r.unmatchedEntries).toEqual([]);
  });

  it("shows what is left and the difference", () => {
    const lines = [line("L1", "2026-10-03", 15_000, { matched_transaction_id: "E1" }), line("Fee", "2026-10-31", -50)];
    const r = reconcile(month, lines, entries, new Map([["E1", "2026-10-03"]]), new Map([["E1", { date: "2026-10-03", cancelled: false }]]));
    expect(r.unmatchedLines.map((l) => l.id)).toEqual(["Fee"]);
    expect(r.unmatchedEntries.map((e) => e.id)).toEqual(["E2", "Late"]);
    expect(r.difference_sen).toBe(15_000 - 50 - (15_000 - 123_450 + 2_000));
  });

  it("leaves out an entry and its cancellation in the same month", () => {
    const pair = [entry("E1", "2026-10-03", 9_000, "in", { reversed: true }), entry("R1", "2026-10-04", 9_000, "out", { reverses_id: "E1" })];
    const r = reconcile(month, [], pair, new Map(), new Map());
    expect(r.unmatchedEntries).toEqual([]);
    expect(r.difference_sen).toBe(0);
  });

  it("treats a match to a cancelled entry as not matched", () => {
    const lines = [line("L1", "2026-10-03", 9_000, { matched_transaction_id: "Gone" })];
    const r = reconcile(month, lines, [], new Map(), new Map([["Gone", { date: "2026-10-03", cancelled: true }]]));
    expect(r.unmatchedLines.map((l) => l.id)).toEqual(["L1"]);
  });

  it("lists matches that cross into another month", () => {
    const lines = [line("L1", "2026-10-01", 3_000, { matched_transaction_id: "Sept" })];
    const r = reconcile(month, lines, [entry("Oct", "2026-10-31", 4_000, "in")], new Map([["Oct", "2026-11-02"]]), new Map([["Sept", { date: "2026-09-30", cancelled: false }]]));
    expect(r.otherMonthLines.map((l) => l.id)).toEqual(["L1"]);
    expect(r.otherMonthEntries.map((e) => e.id)).toEqual(["Oct"]);
  });

  it("moves dates by whole days", () => {
    expect(shiftDate("2026-10-01", -3)).toBe("2026-09-28");
    expect(shiftDate("2026-12-30", 3)).toBe("2027-01-02");
  });
});
