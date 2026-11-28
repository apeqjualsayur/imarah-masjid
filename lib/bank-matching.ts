// Matching bank lines to ledger entries, and the monthly reconciliation.
// Pure functions: the screens load the rows, these decide.

export const MATCH_DAYS = 3;

export type BankRow = {
  id: string;
  date: string;
  /** Signed: money in positive, money out negative. */
  amount_sen: number;
  description: string | null;
  matched_transaction_id: string | null;
  cash_transfer: boolean;
  rejected_ids: string[];
};

export type LedgerRow = {
  id: string;
  date: string;
  amount_sen: number;
  direction: "in" | "out";
  method: string;
  reverses_id: string | null;
  /** Another entry cancels this one. */
  reversed: boolean;
};

export const signed = (entry: Pick<LedgerRow, "amount_sen" | "direction">) =>
  entry.direction === "in" ? entry.amount_sen : -entry.amount_sen;

/** Cash never passes through the bank. */
export const isBankEntry = (entry: Pick<LedgerRow, "method">) => entry.method !== "cash";

/** An entry a bank line may be matched to: a bank method, not cancelled, not a cancellation. */
export const canMatch = (entry: LedgerRow) => isBankEntry(entry) && !entry.reverses_id && !entry.reversed;

export function daysApart(a: string, b: string) {
  return Math.abs(Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / 86_400_000;
}

/** "2026-11-01" moved by `days`. */
export function shiftDate(date: string, days: number) {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
}

/** A line explained by nothing yet. A match to an entry that was later cancelled does not count. */
export function needsMatch(line: BankRow, cancelled: Set<string>) {
  if (line.cash_transfer) return false;
  return !line.matched_transaction_id || cancelled.has(line.matched_transaction_id);
}

/**
 * Suggests one entry per open line: same amount and direction, dated within
 * three days, not already taken, not turned down for that line. The closest
 * dates are paired first, and each entry is suggested once.
 */
export function suggestMatches(lines: BankRow[], entries: LedgerRow[], taken: Set<string>, maxDays = MATCH_DAYS) {
  const cancelled = new Set(entries.filter((entry) => entry.reversed || entry.reverses_id).map((entry) => entry.id));
  const open = lines.filter((line) => needsMatch(line, cancelled));
  const free = entries.filter((entry) => canMatch(entry) && !taken.has(entry.id));

  const pairs: { line: BankRow; entry: LedgerRow; days: number }[] = [];
  for (const line of open) {
    for (const entry of free) {
      if (signed(entry) !== line.amount_sen || line.rejected_ids.includes(entry.id)) continue;
      const days = daysApart(line.date, entry.date);
      if (days <= maxDays) pairs.push({ line, entry, days });
    }
  }
  pairs.sort(
    (a, b) =>
      a.days - b.days ||
      a.line.date.localeCompare(b.line.date) ||
      a.entry.date.localeCompare(b.entry.date) ||
      a.line.id.localeCompare(b.line.id) ||
      a.entry.id.localeCompare(b.entry.id),
  );

  const suggestions = new Map<string, string>();
  const used = new Set<string>();
  for (const { line, entry } of pairs) {
    if (suggestions.has(line.id) || used.has(entry.id)) continue;
    suggestions.set(line.id, entry.id);
    used.add(entry.id);
  }
  return suggestions;
}

/** Entries a line could be matched to by hand: same amount and direction, any date, closest first. */
export function candidatesFor<T extends LedgerRow>(line: Pick<BankRow, "date" | "amount_sen">, entries: T[], taken: Set<string>): T[] {
  return entries
    .filter((entry) => canMatch(entry) && !taken.has(entry.id) && signed(entry) === line.amount_sen)
    .sort((a, b) => daysApart(line.date, a.date) - daysApart(line.date, b.date) || a.date.localeCompare(b.date));
}

export type Reconciliation<T extends LedgerRow = LedgerRow> = {
  /** All bank lines in the month. */
  bank_sen: number;
  /** Bank-method entries in the month (cancellations included), plus lines marked as cash. */
  ledger_sen: number;
  entries_sen: number;
  cash_sen: number;
  difference_sen: number;
  unmatchedLines: BankRow[];
  unmatchedEntries: T[];
  /** Matched, but the bank line and the entry fall in different months. */
  otherMonthLines: BankRow[];
  otherMonthEntries: T[];
  matchedLines: BankRow[];
  cashLines: BankRow[];
};

/**
 * The month's reconciliation. `lines` and `entries` are the month's rows;
 * `matchedBy` maps an entry id to the date of the bank line matched to it (in
 * any month); `matchedDates` maps an entry id to its date, for lines matched
 * to entries outside the month.
 */
export function reconcile<T extends LedgerRow>(
  month: string,
  lines: BankRow[],
  entries: T[],
  matchedBy: Map<string, string>,
  matchedDates: Map<string, { date: string; cancelled: boolean }>,
): Reconciliation<T> {
  const inMonth = (date: string) => date.startsWith(month);
  const bankEntries = entries.filter((entry) => isBankEntry(entry) && inMonth(entry.date));
  const cancelled = new Set<string>();
  for (const entry of entries) if (entry.reversed || entry.reverses_id) cancelled.add(entry.id);
  for (const [id, info] of matchedDates) if (info.cancelled) cancelled.add(id);

  const monthLines = lines.filter((line) => inMonth(line.date));
  const bank_sen = monthLines.reduce((sum, line) => sum + line.amount_sen, 0);
  const cashLines = monthLines.filter((line) => line.cash_transfer);
  const cash_sen = cashLines.reduce((sum, line) => sum + line.amount_sen, 0);
  const entries_sen = bankEntries.reduce((sum, entry) => sum + signed(entry), 0);

  const unmatchedLines = monthLines.filter((line) => needsMatch(line, cancelled));
  const matchedLines = monthLines.filter((line) => !line.cash_transfer && !needsMatch(line, cancelled));
  const otherMonthLines = matchedLines.filter((line) => {
    const date = matchedDates.get(line.matched_transaction_id!)?.date;
    return !!date && !inMonth(date);
  });

  // An entry and its cancellation in the same month cancel out and are left off the list.
  const byId = new Map(bankEntries.map((entry) => [entry.id, entry]));
  const pairedOut = new Set<string>();
  for (const entry of bankEntries) {
    if (entry.reverses_id && byId.has(entry.reverses_id)) {
      pairedOut.add(entry.id);
      pairedOut.add(entry.reverses_id);
    }
  }
  const unmatchedEntries = bankEntries.filter((entry) => !pairedOut.has(entry.id) && !matchedBy.has(entry.id));
  const otherMonthEntries = bankEntries.filter((entry) => {
    const date = matchedBy.get(entry.id);
    return !!date && !inMonth(date);
  });

  const ledger_sen = entries_sen + cash_sen;
  return {
    bank_sen,
    ledger_sen,
    entries_sen,
    cash_sen,
    difference_sen: bank_sen - ledger_sen,
    unmatchedLines,
    unmatchedEntries,
    otherMonthLines,
    otherMonthEntries,
    matchedLines,
    cashLines,
  };
}
