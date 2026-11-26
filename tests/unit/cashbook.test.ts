import { describe, expect, it } from "vitest";
import { checkAttachment } from "@/lib/attachment";
import {
  cashbookError,
  currentMonth,
  fundBalances,
  isIsoDate,
  ledgerCsv,
  monthRange,
  parseMonth,
  runningBalances,
  safeCell,
  shiftMonth,
  sides,
  todayInMalaysia,
  totals,
  type CsvLabels,
  type Entry,
} from "@/lib/cashbook";
import { parseRinggit, senToPlain } from "@/lib/money";
import {
  EXPECTED_AM_NOVEMBER,
  EXPECTED_BALANCES,
  EXPECTED_MONTHS,
  EXPECTED_TOTAL,
  REVERSED,
  TEN_ENTRIES,
} from "../fixtures/ten-entries";

describe("parseRinggit", () => {
  it.each([
    ["1234.50", 123_450],
    ["1,234.50", 123_450],
    ["1,234.5", 123_450],
    ["RM 10", 1_000],
    ["rm10.00", 1_000],
    ["0.5", 50],
    [".05", 5],
    ["0.01", 1],
    ["  12  ", 1_200],
    ["1,000,000", 100_000_000],
    ["10000000.00", 1_000_000_000],
  ])("reads %s as %i sen", (input, sen) => {
    expect(parseRinggit(input)).toEqual({ ok: true, sen });
  });

  it("never uses floating point: 0.29, 1.15 and 4.35 are exact", () => {
    expect(parseRinggit("0.29")).toEqual({ ok: true, sen: 29 });
    expect(parseRinggit("1.15")).toEqual({ ok: true, sen: 115 });
    expect(parseRinggit("4.35")).toEqual({ ok: true, sen: 435 });
  });

  it.each(["0.005", "1.234", "-5", "1,23", "12,34.00", "abc", "1.2.3", "RM", "1e5", "1 000,50", "."])(
    "refuses %s",
    (input) => {
      expect(parseRinggit(input).ok).toBe(false);
    },
  );

  it("says what is wrong", () => {
    expect(parseRinggit("")).toEqual({ ok: false, error: "amount_missing" });
    expect(parseRinggit("0.00")).toEqual({ ok: false, error: "amount_zero" });
    expect(parseRinggit("10000000.01")).toEqual({ ok: false, error: "amount_too_big" });
    expect(parseRinggit("99999999999")).toEqual({ ok: false, error: "amount_too_big" });
    expect(parseRinggit("1.234")).toEqual({ ok: false, error: "amount_bad" });
  });
});

describe("senToPlain", () => {
  it("writes a plain number for spreadsheets", () => {
    expect(senToPlain(123_450)).toBe("1234.50");
    expect(senToPlain(5)).toBe("0.05");
    expect(senToPlain(-128_460)).toBe("-1284.60");
  });
});

const entry = (direction: "in" | "out", amount_sen: number, reverses_id: string | null = null): Entry => ({
  direction,
  amount_sen,
  reverses_id,
});

describe("income and expense with reversals", () => {
  it("an ordinary receipt is income, a payment is expense", () => {
    expect(sides(entry("in", 500))).toEqual({ in_sen: 500, out_sen: 0 });
    expect(sides(entry("out", 500))).toEqual({ in_sen: 0, out_sen: 500 });
  });

  it("cancelling a receipt lowers income instead of adding an expense", () => {
    expect(totals([entry("in", 10_000), entry("out", 10_000, "x")])).toEqual({ in_sen: 0, out_sen: 0, net_sen: 0 });
  });

  it("cancelling a payment lowers expense instead of adding income", () => {
    expect(totals([entry("out", 2_500), entry("in", 2_500, "x"), entry("in", 1_000)])).toEqual({
      in_sen: 1_000,
      out_sen: 0,
      net_sen: 1_000,
    });
  });

  it("a cancellation in a later month can make that month's income negative", () => {
    expect(totals([entry("out", 10_000, "x")])).toEqual({ in_sen: -10_000, out_sen: 0, net_sen: -10_000 });
  });

  it("running balance starts from the opening balance", () => {
    expect(runningBalances([entry("in", 1_000), entry("out", 250), entry("in", 250, "x")], 5_000)).toEqual([
      6_000, 5_750, 6_000,
    ]);
  });

  it("stays exact over many small amounts", () => {
    const many = Array.from({ length: 10_000 }, () => entry("in", 1));
    expect(totals(many).in_sen).toBe(10_000);
  });
});

describe("ten known entries, one cancelled (worked out by hand)", () => {
  const ids = new Map(TEN_ENTRIES.map((item) => [item.n, `id-${item.n}`]));
  const rows = TEN_ENTRIES.map((item) => {
    const parsed = parseRinggit(item.amount);
    return {
      id: ids.get(item.n)!,
      date: item.date,
      fund_id: item.fund,
      direction: item.direction,
      amount_sen: parsed.ok ? parsed.sen : Number.NaN,
      reverses_id: null as string | null,
    };
  });
  const original = rows.find((row) => row.id === ids.get(REVERSED))!;
  rows.push({ ...original, id: "reversal", date: "2026-11-20", direction: "in", reverses_id: original.id });

  it("each amount, typed as a person would, is read exactly", () => {
    expect(TEN_ENTRIES.map((item) => parseRinggit(item.amount))).toEqual(TEN_ENTRIES.map((item) => ({ ok: true, sen: item.sen })));
  });

  it("each fund's balance matches", () => {
    expect(Object.fromEntries(fundBalances(rows))).toEqual(EXPECTED_BALANCES);
  });

  it("the total of all funds matches", () => {
    expect([...fundBalances(rows).values()].reduce((sum, value) => sum + value, 0)).toBe(EXPECTED_TOTAL);
  });

  it.each(Object.entries(EXPECTED_MONTHS))("%s income and expense match", (month, expected) => {
    const inMonth = rows.filter((row) => row.date.startsWith(month));
    const sums = totals(inMonth);
    expect({ in_sen: sums.in_sen, out_sen: sums.out_sen }).toEqual(expected);
  });

  it("Tabung Am's November opening, running and closing balance match", () => {
    const am = rows.filter((row) => row.fund_id === "am");
    const before = am.filter((row) => row.date < "2026-11-01");
    const november = am.filter((row) => row.date.startsWith("2026-11"));
    const opening = [...fundBalances(before).values()][0];
    expect(opening).toBe(EXPECTED_AM_NOVEMBER.opening_sen);
    expect(runningBalances(november, opening).at(-1)).toBe(EXPECTED_AM_NOVEMBER.closing_sen);
    expect(totals(november)).toMatchObject({ in_sen: EXPECTED_AM_NOVEMBER.in_sen, out_sen: EXPECTED_AM_NOVEMBER.out_sen });
  });
});

describe("dates", () => {
  it("uses the day in Malaysia, not the server's", () => {
    // 16:30 UTC on 30 Nov is already 1 Dec in Malaysia.
    expect(todayInMalaysia(new Date("2026-11-30T16:30:00Z"))).toBe("2026-12-01");
    expect(currentMonth(new Date("2026-11-30T16:30:00Z"))).toBe("2026-12");
    expect(todayInMalaysia(new Date("2026-11-30T15:59:00Z"))).toBe("2026-11-30");
  });

  it("knows month lengths", () => {
    expect(monthRange("2026-02")).toEqual({ from: "2026-02-01", to: "2026-02-28" });
    expect(monthRange("2028-02")).toEqual({ from: "2028-02-01", to: "2028-02-29" });
    expect(monthRange("2026-12")).toEqual({ from: "2026-12-01", to: "2026-12-31" });
  });

  it("moves across years", () => {
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
  });

  it("accepts only real months and dates", () => {
    expect(parseMonth("2026-11")).toBe("2026-11");
    expect(parseMonth("2026-13")).toBeNull();
    expect(parseMonth("26-11")).toBeNull();
    expect(parseMonth(["2026-11"])).toBeNull();
    expect(isIsoDate("2026-02-29")).toBe(false);
    expect(isIsoDate("2028-02-29")).toBe(true);
    expect(isIsoDate("2026-1-5")).toBe(false);
  });
});

describe("database refusals become plain messages", () => {
  it.each([
    ["locked period: 2026-09-15 is in a locked month", "locked_month"],
    ["transaction: the date is in the future", "date_future"],
    ["transaction: the fund is archived", "fund_archived"],
    ["transaction: the category does not match receipt or payment", "category_mismatch"],
    ["reversal: a reason is required", "reason_missing"],
    ["reversal: a reversal cannot itself be reversed", "reverse_reversal"],
    ["funds: a fund with money in it cannot be archived", "fund_not_empty"],
  ])("%s", (message, key) => {
    expect(cashbookError({ message })).toBe(key);
  });

  it("knows a second cancellation from a duplicate name", () => {
    expect(cashbookError({ code: "23505", message: 'duplicate key value violates unique constraint "transactions_reverses_id_key"' })).toBe(
      "already_reversed",
    );
    expect(cashbookError({ code: "23505", message: 'duplicate key value violates unique constraint "funds_masjid_id_name_key"' })).toBe(
      "name_taken",
    );
  });

  it("falls back to a general message", () => {
    expect(cashbookError(null)).toBe("generic");
    expect(cashbookError({ message: "something else" })).toBe("generic");
  });
});

describe("CSV export", () => {
  const labels: CsvLabels = {
    headers: ["Tarikh", "Rujukan", "Dana", "Kategori", "Kaedah", "Catatan", "Masuk (RM)", "Keluar (RM)", "Status", "Sebab"],
    method: { cash: "Tunai", bank_transfer: "Pindahan bank", duitnow: "DuitNow", cheque: "Cek" },
    status: { posted: "Sah", reversed: "Dibatalkan", reversal: "Pembatalan" },
  };

  it("writes amounts as plain numbers in separate columns", () => {
    const csv = ledgerCsv(
      [
        {
          date: "2026-11-06",
          ref_no: "RC-1",
          fund: "Tabung Am",
          category: "Kutipan Jumaat",
          method: "cash",
          note: "Jumaat, 6 Nov",
          direction: "in",
          amount_sen: 110_525,
          reverses_id: null,
          reversal_reason: null,
          status: "posted",
        },
      ],
      labels,
    );
    const lines = csv.replace(/^﻿/, "").trim().split("\r\n");
    expect(lines[1]).toBe('2026-11-06,RC-1,Tabung Am,Kutipan Jumaat,Tunai,"Jumaat, 6 Nov",1105.25,,Sah,');
  });

  it("stops Excel running a typed formula", () => {
    expect(safeCell("=HYPERLINK(\"x\")")).toBe("'=HYPERLINK(\"x\")");
    expect(safeCell("+60123")).toBe("'+60123");
    expect(safeCell("@SUM(A1)")).toBe("'@SUM(A1)");
    expect(safeCell("Derma")).toBe("Derma");
  });
});

describe("attachments", () => {
  const bytes = (...values: number[]) => new Uint8Array(values);
  const text = (value: string) => new TextEncoder().encode(value);

  it("knows JPG, PNG, WebP and PDF by their bytes", () => {
    expect(checkAttachment(bytes(0xff, 0xd8, 0xff, 0xe0, 0, 0))).toMatchObject({ ok: true, ext: "jpg" });
    expect(checkAttachment(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0))).toMatchObject({ ok: true, ext: "png" });
    expect(checkAttachment(text("RIFF\0\0\0\0WEBPVP8 "))).toMatchObject({ ok: true, ext: "webp" });
    expect(checkAttachment(text("%PDF-1.7\n"))).toMatchObject({ ok: true, ext: "pdf" });
  });

  it("refuses other files, whatever their name", () => {
    expect(checkAttachment(text("<html><script>x</script></html>"))).toEqual({ ok: false, error: "attachment_wrong_type" });
    expect(checkAttachment(text("<svg></svg>"))).toEqual({ ok: false, error: "attachment_wrong_type" });
    expect(checkAttachment(bytes(0x50, 0x4b, 3, 4))).toEqual({ ok: false, error: "attachment_wrong_type" });
  });

  it("refuses files over 5 MB", () => {
    const big = new Uint8Array(5 * 1024 * 1024 + 1);
    big.set([0xff, 0xd8, 0xff]);
    expect(checkAttachment(big)).toEqual({ ok: false, error: "attachment_too_big" });
  });
});
