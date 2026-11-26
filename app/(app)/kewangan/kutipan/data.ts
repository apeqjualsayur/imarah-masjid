import "server-only";
import type { Breakdown, CollectionStatus } from "@/lib/collections";
import { createClient } from "@/lib/supabase/server";

export type Collection = {
  id: string;
  date: string;
  fund_id: string;
  total_sen: number;
  status: CollectionStatus;
  breakdown: Breakdown | null;
  note: string | null;
  counted_by: string;
  checked_by: string | null;
  check_total_sen: number | null;
  confirmed_by: string | null;
  confirmed_at: string | null;
  transaction_id: string | null;
  void_reason: string | null;
  voided_by: string | null;
  created_at: string;
  updated_at: string;
};

export const COLLECTION_COLUMNS =
  "id, date, fund_id, total_sen, status, breakdown, note, counted_by, checked_by, check_total_sen, confirmed_by, confirmed_at, transaction_id, void_reason, voided_by, created_at, updated_at";

/** Counts still waiting for someone: to confirm, or to recount after a difference. */
export async function loadOpenCollections(): Promise<Collection[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("collections")
    .select(COLLECTION_COLUMNS)
    .in("status", ["counted", "needs_review"])
    .order("date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw new Error(error.message);
  return data as Collection[];
}

export async function loadRecentCollections(limit = 30): Promise<Collection[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("collections")
    .select(COLLECTION_COLUMNS)
    .in("status", ["confirmed", "void"])
    .order("date", { ascending: false })
    .order("updated_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return data as Collection[];
}

/**
 * The first count stays hidden until it is confirmed, so the second person
 * counts for themselves. The counter sees their own figure; after a
 * difference both figures are shown so the two can agree.
 */
export function amountVisible(collection: Collection, userId: string) {
  return collection.status !== "counted" || collection.counted_by === userId;
}
