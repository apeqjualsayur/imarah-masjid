// Friday collections: the note breakdown, the offline queue and the plain
// messages for the database's refusals. Pure functions, so they are easy to test.

/** Malaysian notes counted one by one. Coins are entered as one ringgit amount. */
export const NOTES = [100, 50, 20, 10, 5, 1] as const;
export type Note = (typeof NOTES)[number];

/** {"100": 3, "50": 2, ..., "coins_sen": 450}, as the database stores it. */
export type Breakdown = Partial<Record<`${Note}`, number>> & { coins_sen?: number };

export function breakdownTotal(breakdown: Breakdown): number {
  let total = breakdown.coins_sen ?? 0;
  for (const note of NOTES) total += (breakdown[`${note}`] ?? 0) * note * 100;
  return total;
}

/** Keeps only notes with a count, so an empty breakdown becomes null. */
export function cleanBreakdown(breakdown: Breakdown): Breakdown | null {
  const clean: Breakdown = {};
  for (const note of NOTES) {
    const count = breakdown[`${note}`];
    if (count) clean[`${note}`] = count;
  }
  if (breakdown.coins_sen) clean.coins_sen = breakdown.coins_sen;
  return Object.keys(clean).length > 0 ? clean : null;
}

/** A note count typed by hand: whole, not negative, empty means 0. Null when not valid. */
export function parseCount(value: string): number | null {
  const text = value.trim();
  if (!text) return 0;
  if (!/^\d{1,6}$/.test(text)) return null;
  return Number(text);
}

export type CollectionStatus = "counted" | "needs_review" | "confirmed" | "void";

/** Turns the database's refusals into keys under "errors" in messages/*.json. */
export function collectionError(error: { code?: string; message?: string } | null): string {
  const message = error?.message ?? "";
  if (message.includes("locked period")) return "locked_month";
  if (message.includes("your own count") || message.includes("check their own count")) return "own_count";
  if (message.includes("in the future")) return "date_future";
  if (message.includes("open fund") || message.includes("fund is archived")) return "fund_archived";
  if (message.includes("does not add up")) return "breakdown_mismatch";
  if (message.includes("recount first")) return "needs_recount";
  if (message.includes("was cancelled") || message.includes("cannot be changed")) return "collection_closed";
  if (message.includes("reason is required")) return "reason_missing";
  if (message.includes("more than zero")) return "amount_zero";
  if (message.includes("not found")) return "not_found";
  if (error?.code === "42501") return "not_allowed";
  return "generic";
}

// Offline queue -------------------------------------------------------------

/** A count saved on the phone while it had no signal. `key` makes re-sending safe. */
export type QueuedCount = {
  key: string;
  date: string;
  fund_id: string;
  fund_name: string;
  total_sen: number;
  breakdown: Breakdown | null;
  note: string;
  saved_at: string;
};

type Store = Pick<Storage, "getItem" | "setItem" | "removeItem">;

/** One queue per person, so a shared phone never sends one person's count as another's. */
export const queueName = (userId: string) => `imarah.kutipan.${userId}`;

export function readQueue(store: Store | null, userId: string): QueuedCount[] {
  try {
    const raw = store?.getItem(queueName(userId));
    const items = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(items) ? items.filter((item): item is QueuedCount => typeof item?.key === "string") : [];
  } catch {
    return [];
  }
}

function writeQueue(store: Store | null, userId: string, items: QueuedCount[]) {
  try {
    if (items.length === 0) store?.removeItem(queueName(userId));
    else store?.setItem(queueName(userId), JSON.stringify(items));
  } catch {
    // Storage can be blocked (private mode). The form then says it could not keep the count.
  }
}

/** Adds a count; the same key twice is kept once. */
export function enqueue(store: Store | null, userId: string, item: QueuedCount): QueuedCount[] {
  const items = readQueue(store, userId).filter((existing) => existing.key !== item.key);
  items.push(item);
  writeQueue(store, userId, items);
  return readQueue(store, userId);
}

export function dequeue(store: Store | null, userId: string, key: string): QueuedCount[] {
  writeQueue(store, userId, readQueue(store, userId).filter((item) => item.key !== key));
  return readQueue(store, userId);
}

/** True when a server call failed because the phone could not reach it, not because it was refused. */
export function isNetworkFailure(error: unknown): boolean {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return true;
  return error instanceof TypeError || (error instanceof Error && /fetch|network|load failed/i.test(error.message));
}
