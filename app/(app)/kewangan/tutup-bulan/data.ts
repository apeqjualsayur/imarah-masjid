import "server-only";
import { reconcile } from "@/lib/bank-matching";
import { monthRange } from "@/lib/cashbook";
import { lockChecklist } from "@/lib/periods";
import { createClient } from "@/lib/supabase/server";
import { loadBankMonth } from "../bank/data";

export type Period = {
  id: string;
  month: string;
  locked_at: string | null;
  locked_by: string | null;
  unlock_reason: string | null;
};

export type PendingCollection = { id: string; date: string; total_sen: number; status: "counted" | "needs_review" };
export type MonthReport = { id: string; type: string; period: string; created_at: string; invalidated_at: string | null };
export type LockEvent = { id: string; at: string; user_id: string | null; kind: "lock" | "unlock"; reason: string | null };

/** Every month record of the masjid, keyed "YYYY-MM". */
export async function loadPeriods(): Promise<Map<string, Period>> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("periods").select("id, month, locked_at, locked_by, unlock_reason").order("month", { ascending: false });
  if (error) throw new Error(error.message);
  return new Map((data as Period[]).map((row) => [row.month.slice(0, 7), row]));
}

/** What the checklist needs for one month. */
export async function loadChecklist(month: string) {
  const supabase = await createClient();
  const { from, to } = monthRange(month);
  const [collections, bank] = await Promise.all([
    supabase
      .from("collections")
      .select("id, date, total_sen, status")
      .gte("date", from)
      .lte("date", to)
      .in("status", ["counted", "needs_review"])
      .order("date"),
    loadBankMonth(month),
  ]);
  if (collections.error) throw new Error(collections.error.message);
  const pending = (collections.data as PendingCollection[]).map((row) => ({ ...row, total_sen: Number(row.total_sen) }));
  const r = reconcile(month, bank.lines, bank.entries, bank.matchedBy, bank.matchedDates);
  const checklist = lockChecklist({
    pendingCollections: pending.length,
    unmatchedBankLines: r.unmatchedLines.length,
    unmatchedEntries: r.unmatchedEntries.length,
    bankDifferenceSen: r.difference_sen,
    hasBankLines: bank.lines.length > 0,
  });
  return { pending, checklist };
}

/** Reports that cover the month: its monthly reports and the year's. */
export async function loadMonthReports(month: string): Promise<MonthReport[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("reports")
    .select("id, type, period, created_at, invalidated_at")
    .in("period", [month, month.slice(0, 4)])
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data as MonthReport[];
}

/** Every lock and unlock of this month, newest first, from the audit log. */
export async function loadLockHistory(periodId: string): Promise<LockEvent[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("audit_log")
    .select("id, at, user_id, action, before, after")
    .eq("table_name", "periods")
    .eq("row_id", periodId)
    .order("at", { ascending: false });
  if (error) throw new Error(error.message);
  const events: LockEvent[] = [];
  for (const row of data as { id: string; at: string; user_id: string | null; action: string; before: Record<string, unknown> | null; after: Record<string, unknown> | null }[]) {
    const was = !!row.before?.locked_at;
    const is = !!row.after?.locked_at;
    if (is && !was) events.push({ id: row.id, at: row.at, user_id: row.user_id, kind: "lock", reason: null });
    if (was && !is) events.push({ id: row.id, at: row.at, user_id: row.user_id, kind: "unlock", reason: (row.after?.unlock_reason as string) ?? null });
  }
  return events;
}
