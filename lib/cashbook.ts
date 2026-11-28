// The cash book's arithmetic and small rules. Pure functions in integer sen,
// so they are easy to test. The database does the same sums in fund_summary
// and masjid_totals; the tests check that both agree.

import { toCsv } from "./csv";
import { senToPlain } from "./money";

export const METHODS = ["cash", "bank_transfer", "duitnow", "cheque"] as const;
export type Method = (typeof METHODS)[number];
export const isMethod = (value: unknown): value is Method => METHODS.includes(value as Method);

export const NOTE_MAX = 500;
export const REF_MAX = 60;
export const REASON_MAX = 300;
export const RECEIVED_FROM_MAX = 100;
export const FUND_NAME_MAX = 60;

export type Entry = {
  amount_sen: number;
  direction: "in" | "out";
  reverses_id: string | null;
};

/** What an entry does to its fund's balance. */
export function signedSen(entry: Entry): number {
  return entry.direction === "in" ? entry.amount_sen : -entry.amount_sen;
}

/**
 * Income and expense, with a reversal counted against the side of the entry
 * it cancels: a cancelled receipt lowers income rather than adding an expense.
 */
export function sides(entry: Entry): { in_sen: number; out_sen: number } {
  const reversal = entry.reverses_id !== null;
  if (entry.direction === "in") return reversal ? { in_sen: 0, out_sen: -entry.amount_sen } : { in_sen: entry.amount_sen, out_sen: 0 };
  return reversal ? { in_sen: -entry.amount_sen, out_sen: 0 } : { in_sen: 0, out_sen: entry.amount_sen };
}

export type Totals = { in_sen: number; out_sen: number; net_sen: number };

export function totals(entries: Entry[]): Totals {
  let inSen = 0;
  let outSen = 0;
  for (const entry of entries) {
    const side = sides(entry);
    inSen += side.in_sen;
    outSen += side.out_sen;
  }
  return { in_sen: inSen, out_sen: outSen, net_sen: inSen - outSen };
}

/** The balance after each entry, starting from `opening`. Entries must already be in date order. */
export function runningBalances(entries: Entry[], opening: number): number[] {
  let balance = opening;
  return entries.map((entry) => (balance += signedSen(entry)));
}

/** Balance per fund from a list of entries. */
export function fundBalances(entries: (Entry & { fund_id: string })[]): Map<string, number> {
  const balances = new Map<string, number>();
  for (const entry of entries) balances.set(entry.fund_id, (balances.get(entry.fund_id) ?? 0) + signedSen(entry));
  return balances;
}

// Dates. The masjid's day is the day in Malaysia, whatever the server's clock zone.

export function todayInMalaysia(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kuala_Lumpur" }).format(now);
}

export const currentMonth = (now = new Date()) => todayInMalaysia(now).slice(0, 7);

/** "2026-11" from a URL, or null when it is not a real month. */
export function parseMonth(value: unknown): string | null {
  if (typeof value !== "string" || !/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) return null;
  const year = Number(value.slice(0, 4));
  return year >= 2000 && year <= 2100 ? value : null;
}

/** First and last day of a month: "2026-02" -> 2026-02-01 to 2026-02-28. */
export function monthRange(month: string): { from: string; to: string } {
  const [year, m] = month.split("-").map(Number);
  const last = new Date(Date.UTC(year, m, 0)).getUTCDate();
  return { from: `${month}-01`, to: `${month}-${String(last).padStart(2, "0")}` };
}

export function shiftMonth(month: string, by: number): string {
  const [year, m] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year, m - 1 + by, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** A real calendar date in yyyy-mm-dd. */
export function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
}

/** Turns the database's refusals into keys under "errors" in messages/*.json. */
export function cashbookError(error: { code?: string; message?: string } | null): string {
  const message = error?.message ?? "";
  if (message.includes("locked period")) return "locked_month";
  if (message.includes("in the future")) return "date_future";
  if (message.includes("fund is archived")) return "fund_archived";
  if (message.includes("category is archived")) return "category_archived";
  if (message.includes("does not match")) return "category_mismatch";
  if (message.includes("reason is required")) return "reason_missing";
  if (message.includes("cannot itself be reversed")) return "reverse_reversal";
  if (message.includes("dated before the original")) return "reversal_before_original";
  if (message.includes("with money in it")) return "fund_not_empty";
  if (error?.code === "23505") return message.includes("reverses_id") ? "already_reversed" : "name_taken";
  if (error?.code === "42501") return "not_allowed";
  return "generic";
}

// CSV export ----------------------------------------------------------------

export type LedgerRow = Entry & {
  date: string;
  ref_no: string | null;
  fund: string;
  category: string | null;
  method: Method;
  note: string | null;
  reversal_reason: string | null;
  status: "posted" | "reversed" | "reversal";
};

export type CsvLabels = {
  headers: [string, string, string, string, string, string, string, string, string, string];
  method: Record<Method, string>;
  status: Record<LedgerRow["status"], string>;
};

/** A cell Excel would run as a formula gets a leading apostrophe instead. */
export function safeCell(value: string): string {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

/** Ledger rows as CSV: amounts as plain numbers in separate in and out columns, so Excel can add them. */
export function ledgerCsv(rows: LedgerRow[], labels: CsvLabels): string {
  return toCsv([
    labels.headers,
    ...rows.map((row) => [
      row.date,
      safeCell(row.ref_no ?? ""),
      safeCell(row.fund),
      safeCell(row.category ?? ""),
      labels.method[row.method],
      safeCell(row.note ?? ""),
      row.direction === "in" ? senToPlain(row.amount_sen) : "",
      row.direction === "out" ? senToPlain(row.amount_sen) : "",
      labels.status[row.status],
      safeCell(row.reversal_reason ?? ""),
    ]),
  ]);
}
