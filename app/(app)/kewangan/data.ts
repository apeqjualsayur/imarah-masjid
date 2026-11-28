import "server-only";
import { cache } from "react";
import { monthRange, type Method } from "@/lib/cashbook";
import { createClient } from "@/lib/supabase/server";

export type Fund = { id: string; name: string; restricted: boolean; archived_at: string | null };
export type Category = { id: string; name: string; type: "income" | "expense"; archived_at: string | null };

export type Transaction = {
  id: string;
  date: string;
  fund_id: string;
  category_id: string | null;
  amount_sen: number;
  direction: "in" | "out";
  method: Method;
  ref_no: string | null;
  note: string | null;
  reverses_id: string | null;
  reversal_reason: string | null;
  attachment_path: string | null;
  receipt_no: string | null;
  received_from: string | null;
  khairat_member_id: string | null;
  created_by: string | null;
  created_at: string;
};

export const TRANSACTION_COLUMNS =
  "id, date, fund_id, category_id, amount_sen, direction, method, ref_no, note, reverses_id, reversal_reason, attachment_path, receipt_no, received_from, khairat_member_id, created_by, created_at";

/** All the masjid's funds, open ones first. */
export const loadFunds = cache(async (): Promise<Fund[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("funds")
    .select("id, name, restricted, archived_at")
    .order("archived_at", { nullsFirst: true })
    .order("created_at")
    .order("name");
  if (error) throw new Error(error.message);
  return data as Fund[];
});

export const loadCategories = cache(async (): Promise<Category[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("categories")
    .select("id, name, type, archived_at")
    .order("type", { ascending: false })
    .order("created_at")
    .order("name");
  if (error) throw new Error(error.message);
  return data as Category[];
});

/** user id -> name, for "recorded by" lines. */
export const loadMemberNames = cache(async (): Promise<Map<string, string>> => {
  const supabase = await createClient();
  const { data } = await supabase.rpc("member_names");
  return new Map(((data ?? []) as { user_id: string; full_name: string }[]).map((row) => [row.user_id, row.full_name]));
});

export type FundSummary = Fund & { opening_sen: number; in_sen: number; out_sen: number; closing_sen: number };

/** Opening, in, out and closing per fund for a date range (either end may be open). */
export async function loadFundSummary(from: string | null, to: string | null): Promise<FundSummary[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("fund_summary", { p_from: from, p_to: to });
  if (error) throw new Error(error.message);
  return (data ?? []) as FundSummary[];
}

export type MasjidTotals = { total_sen: number; month_in_sen: number; month_out_sen: number };

export async function loadMasjidTotals(month: string): Promise<MasjidTotals | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("masjid_totals", { p_month: `${month}-01` });
  if (error) throw new Error(error.message);
  return ((data ?? []) as MasjidTotals[])[0] ?? null;
}

export type LedgerFilters = { month: string; fund: string; category: string; direction: "" | "in" | "out" };

/**
 * One month of entries in date order, plus the ids of those that have been
 * cancelled. A reversal is never dated before its original, so every
 * reversal of this month's entries is dated in this month or later.
 */
export async function loadLedger(filters: LedgerFilters): Promise<{ rows: Transaction[]; reversed: Set<string> }> {
  const { from, to } = monthRange(filters.month);
  const supabase = await createClient();

  let query = supabase
    .from("transactions")
    .select(TRANSACTION_COLUMNS)
    .gte("date", from)
    .lte("date", to)
    .order("date")
    .order("created_at")
    .limit(5000);
  if (filters.fund) query = query.eq("fund_id", filters.fund);
  if (filters.category) query = query.eq("category_id", filters.category);
  if (filters.direction) query = query.eq("direction", filters.direction);

  let reversals = supabase.from("transactions").select("reverses_id").not("reverses_id", "is", null).gte("date", from).limit(5000);
  if (filters.fund) reversals = reversals.eq("fund_id", filters.fund);

  const [entries, cancels] = await Promise.all([query, reversals]);
  if (entries.error) throw new Error(entries.error.message);
  if (cancels.error) throw new Error(cancels.error.message);
  return {
    rows: entries.data as Transaction[],
    reversed: new Set((cancels.data as { reverses_id: string }[]).map((row) => row.reverses_id)),
  };
}

/** Is the month locked? Used to pick a sensible default date. */
export async function isMonthLocked(month: string): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("periods")
    .select("locked_at")
    .eq("month", `${month}-01`)
    .not("locked_at", "is", null)
    .maybeSingle();
  return !!data;
}
