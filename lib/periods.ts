// Month locking: which months can be locked, the checklist before locking,
// and friendly errors. The database enforces the same rules.

import { shiftMonth } from "./cashbook";

export const UNLOCK_REASON_MAX = 300;

/** "2026-10" -> "2026-10-01", the value stored in periods.month. */
export const monthStart = (month: string) => `${month}-01`;

/** Only months that have ended can be locked, so today's entries are never blocked. */
export const canLockMonth = (month: string, current: string) => month < current;

/** The current month and the `count` months before it, newest first. */
export function recentMonths(current: string, count = 12): string[] {
  return Array.from({ length: count + 1 }, (_, i) => shiftMonth(current, -i));
}

export type ChecklistInput = {
  pendingCollections: number;
  unmatchedBankLines: number;
  unmatchedEntries: number;
  bankDifferenceSen: number;
  hasBankLines: boolean;
};

export type ChecklistItem = {
  key: "collections" | "noStatement" | "bankLines" | "bankDifference" | "entries" | "drafts";
  state: "ok" | "warn" | "block";
  count?: number;
  sen?: number;
};

/**
 * The checks shown before locking. Pending collections block the lock (once
 * locked they could never be confirmed); the bank items only warn.
 */
export function lockChecklist(input: ChecklistInput): { items: ChecklistItem[]; blocked: boolean; warnings: number } {
  const items: ChecklistItem[] = [
    { key: "collections", state: input.pendingCollections > 0 ? "block" : "ok", count: input.pendingCollections },
    // Bank entries but no statement imported for the month.
    ...(input.hasBankLines
      ? []
      : [{ key: "noStatement" as const, state: input.unmatchedEntries > 0 ? ("warn" as const) : ("ok" as const), count: input.unmatchedEntries }]),
    { key: "bankLines", state: input.unmatchedBankLines > 0 ? "warn" : "ok", count: input.unmatchedBankLines },
    { key: "bankDifference", state: input.hasBankLines && input.bankDifferenceSen !== 0 ? "warn" : "ok", sen: input.bankDifferenceSen },
    { key: "entries", state: input.hasBankLines && input.unmatchedEntries > 0 ? "warn" : "ok", count: input.unmatchedEntries },
    // Phase 1 has no other drafts.
    { key: "drafts", state: "ok", count: 0 },
  ];
  return {
    items,
    blocked: items.some((item) => item.state === "block"),
    warnings: items.filter((item) => item.state === "warn").length,
  };
}

/** A friendly key for lock and unlock errors from the database. */
export function periodError(error: { code?: string; message?: string } | null): string {
  const message = error?.message ?? "";
  if (message.includes("pending collections")) return "period_pending_collections";
  if (message.includes("has not ended")) return "period_not_ended";
  if (message.includes("already locked")) return "period_already_locked";
  if (message.includes("is not locked")) return "period_not_locked";
  if (message.includes("needs a reason")) return "period_reason_missing";
  if (message.includes("too long")) return "period_reason_too_long";
  if (error?.code === "42501") return "not_allowed";
  return "generic";
}
