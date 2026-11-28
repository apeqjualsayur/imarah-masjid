import "server-only";
import { monthRange } from "@/lib/cashbook";
import { MATCH_DAYS, shiftDate, type BankRow, type LedgerRow } from "@/lib/bank-matching";
import type { BankFormat } from "@/lib/bank-import";
import { createClient } from "@/lib/supabase/server";
import { TRANSACTION_COLUMNS, type Transaction } from "../data";

export type BankLineRow = BankRow & { import_id: string | null };
export type BankEntry = Transaction & LedgerRow;
export type SavedFormat = BankFormat & { id: string; name: string };
export type BankImport = {
  id: string;
  file_name: string;
  lines_added: number;
  lines_skipped: number;
  first_date: string | null;
  last_date: string | null;
  created_at: string;
  cancelled_at: string | null;
};

const LINE_COLUMNS = "id, date, amount_sen, description, matched_transaction_id, cash_transfer, rejected_ids, import_id";
const CHUNK = 100;

type Client = Awaited<ReturnType<typeof createClient>>;

/** Runs a filter-by-ids query in pieces, so the address never gets too long. */
async function inChunks<T>(ids: string[], load: (chunk: string[]) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>) {
  const rows: T[] = [];
  for (let at = 0; at < ids.length; at += CHUNK) {
    const { data, error } = await load(ids.slice(at, at + CHUNK));
    if (error) throw new Error(error.message);
    rows.push(...(data ?? []));
  }
  return rows;
}

/** Which of these entries another entry cancels. */
async function cancelledAmong(supabase: Client, ids: string[]) {
  const rows = await inChunks<{ reverses_id: string }>(ids, (chunk) =>
    supabase.from("transactions").select("reverses_id").in("reverses_id", chunk),
  );
  return new Set(rows.map((row) => row.reverses_id));
}

function toEntries(rows: Transaction[], cancelled: Set<string>): BankEntry[] {
  return rows.map((row) => ({ ...row, amount_sen: Number(row.amount_sen), reversed: cancelled.has(row.id) }));
}

function toLines(rows: BankLineRow[]): BankLineRow[] {
  return rows.map((row) => ({ ...row, amount_sen: Number(row.amount_sen), rejected_ids: row.rejected_ids ?? [] }));
}

/**
 * Everything the month's reconciliation needs: its bank lines, the bank-method
 * entries from three days either side (for suggestions), which entries are
 * already matched to any bank line, and the dates of entries matched to this
 * month's lines from further away.
 */
export async function loadBankMonth(month: string) {
  const supabase = await createClient();
  const { from, to } = monthRange(month);

  const [linesResult, entriesResult] = await Promise.all([
    supabase.from("bank_lines").select(LINE_COLUMNS).gte("date", from).lte("date", to).order("date").order("created_at"),
    supabase
      .from("transactions")
      .select(TRANSACTION_COLUMNS)
      .neq("method", "cash")
      .gte("date", shiftDate(from, -MATCH_DAYS))
      .lte("date", shiftDate(to, MATCH_DAYS))
      .order("date")
      .order("created_at"),
  ]);
  if (linesResult.error) throw new Error(linesResult.error.message);
  if (entriesResult.error) throw new Error(entriesResult.error.message);

  const lines = toLines(linesResult.data as BankLineRow[]);
  const rawEntries = entriesResult.data as Transaction[];
  const entryIds = rawEntries.map((entry) => entry.id);
  const entries = toEntries(rawEntries, await cancelledAmong(supabase, entryIds));

  // Entries already matched, to a line in any month.
  const matches = await inChunks<{ matched_transaction_id: string; date: string }>(entryIds, (chunk) =>
    supabase.from("bank_lines").select("matched_transaction_id, date").in("matched_transaction_id", chunk),
  );
  const matchedBy = new Map(matches.map((row) => [row.matched_transaction_id, row.date]));

  // Dates of the entries this month's lines are matched to.
  const known = new Map(entries.map((entry) => [entry.id, entry]));
  const farIds = [...new Set(lines.map((line) => line.matched_transaction_id).filter((id): id is string => !!id && !known.has(id)))];
  const far = await inChunks<Transaction>(farIds, (chunk) => supabase.from("transactions").select(TRANSACTION_COLUMNS).in("id", chunk));
  const farEntries = toEntries(far, await cancelledAmong(supabase, farIds));
  const matchedDates = new Map<string, { date: string; cancelled: boolean }>();
  for (const entry of [...entries, ...farEntries]) {
    matchedDates.set(entry.id, { date: entry.date, cancelled: entry.reversed || !!entry.reverses_id });
  }

  return { lines, entries, matchedBy, matchedDates, entryById: new Map([...entries, ...farEntries].map((entry) => [entry.id, entry])) };
}

/** One bank line, or null. */
export async function loadBankLine(id: string): Promise<BankLineRow | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("bank_lines").select(LINE_COLUMNS).eq("id", id).maybeSingle();
  return data ? toLines([data as BankLineRow])[0] : null;
}

/** Bank-method entries with this signed amount, any date, with whether each is taken or cancelled. */
export async function loadSameAmount(amountSen: number) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("transactions")
    .select(TRANSACTION_COLUMNS)
    .neq("method", "cash")
    .eq("amount_sen", Math.abs(amountSen))
    .eq("direction", amountSen > 0 ? "in" : "out")
    .is("reverses_id", null)
    .order("date", { ascending: false })
    .limit(300);
  if (error) throw new Error(error.message);
  const rows = data as Transaction[];
  const ids = rows.map((row) => row.id);
  const entries = toEntries(rows, await cancelledAmong(supabase, ids));
  const matched = await inChunks<{ matched_transaction_id: string }>(ids, (chunk) =>
    supabase.from("bank_lines").select("matched_transaction_id").in("matched_transaction_id", chunk),
  );
  return { entries, taken: new Set(matched.map((row) => row.matched_transaction_id)) };
}

/** One entry, for a matched line. */
export async function loadEntry(id: string): Promise<Transaction | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("transactions").select(TRANSACTION_COLUMNS).eq("id", id).maybeSingle();
  return (data as Transaction | null) ?? null;
}

export async function loadFormats(): Promise<SavedFormat[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("bank_formats")
    .select("id, name, date_column, description_columns, debit_column, credit_column, amount_column, date_order")
    .order("name");
  if (error) throw new Error(error.message);
  return data as SavedFormat[];
}

export async function loadImports(limit = 20): Promise<BankImport[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("bank_imports")
    .select("id, file_name, lines_added, lines_skipped, first_date, last_date, created_at, cancelled_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return data as BankImport[];
}

/** Import ids that have a matched or cash-marked line, so they cannot be cancelled. */
export async function importsInUse(ids: string[]): Promise<Set<string>> {
  const supabase = await createClient();
  const rows = await inChunks<{ import_id: string }>(ids, (chunk) =>
    supabase.from("bank_lines").select("import_id").in("import_id", chunk).or("matched_transaction_id.not.is.null,cash_transfer.is.true"),
  );
  return new Set(rows.map((row) => row.import_id));
}

/** Months (YYYY-MM) that are locked. */
export async function lockedMonths(): Promise<Set<string>> {
  const supabase = await createClient();
  const { data } = await supabase.from("periods").select("month").not("locked_at", "is", null);
  return new Set(((data ?? []) as { month: string }[]).map((row) => row.month.slice(0, 7)));
}
