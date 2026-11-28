// Khairat status and arrears. Pure functions, the one place these rules
// live, so the list, the dashboard and the CSV agree and are easy to test.

import { safeCell } from "@/lib/cashbook";
import { toCsv } from "@/lib/csv";
import { senToPlain } from "@/lib/money";

export const COVERAGES = ["household", "person"] as const;
export type Coverage = (typeof COVERAGES)[number];
export const isCoverage = (value: unknown): value is Coverage => COVERAGES.includes(value as Coverage);

export const END_REASON_MAX = 300;

export type KhairatStatus = "aktif" | "tunggakan" | "tamat";
export const STATUSES: KhairatStatus[] = ["aktif", "tunggakan", "tamat"];

/** One household's membership for one year, with its year's setup. */
export type Membership = {
  id: string;
  household_id: string;
  head_name: string;
  year: number;
  fee_sen: number;
  people: number;
  paid_sen: number;
  /** Last day to pay, "2026-03-31". */
  pay_by: string;
  ended_at: string | null;
};

/** What the year costs this household: the fee, times the people covered on a per-person setup. */
export const dueSen = (m: Pick<Membership, "fee_sen" | "people">) => m.fee_sen * m.people;

/** Still to pay for the year, never below zero. */
export const owedSen = (m: Pick<Membership, "fee_sen" | "people" | "paid_sen">) => Math.max(dueSen(m) - m.paid_sen, 0);

/**
 * Tamat when ended; aktif when paid in full or still before the last day to
 * pay; otherwise tunggakan (arrears). `today` is a Malaysian date "2026-11-28".
 */
export function statusOf(m: Membership, today: string): KhairatStatus {
  if (m.ended_at) return "tamat";
  if (owedSen(m) === 0) return "aktif";
  return today <= m.pay_by ? "aktif" : "tunggakan";
}

/** Arrears count only once the last day to pay has passed, and never for ended memberships. */
export const arrearsSen = (m: Membership, today: string) => (statusOf(m, today) === "tunggakan" ? owedSen(m) : 0);

export type KhairatSummary = {
  members: number;
  aktif: number;
  tunggakan: number;
  tamat: number;
  due_sen: number;
  paid_sen: number;
  arrears_sen: number;
};

/** Figures for one year's memberships. Ended memberships are counted but owe nothing. */
export function summarise(rows: Membership[], today: string): KhairatSummary {
  const summary: KhairatSummary = { members: 0, aktif: 0, tunggakan: 0, tamat: 0, due_sen: 0, paid_sen: 0, arrears_sen: 0 };
  for (const row of rows) {
    const status = statusOf(row, today);
    summary[status] += 1;
    summary.paid_sen += row.paid_sen;
    if (status === "tamat") continue;
    summary.members += 1;
    summary.due_sen += dueSen(row);
    summary.arrears_sen += arrearsSen(row, today);
  }
  return summary;
}

/** Per household, the arrears left from years before `year`. */
export function earlierArrears(rows: Membership[], year: number, today: string): Map<string, number> {
  const result = new Map<string, number>();
  for (const row of rows) {
    if (row.year >= year) continue;
    const owed = arrearsSen(row, today);
    if (owed > 0) result.set(row.household_id, (result.get(row.household_id) ?? 0) + owed);
  }
  return result;
}

export type KhairatCsvLabels = {
  headers: [string, string, string, string, string, string, string, string];
  status: Record<KhairatStatus, string>;
};

/** The list as CSV: plain numbers so Excel can add them; earlier arrears in their own column. */
export function khairatCsv(rows: Membership[], earlier: Map<string, number>, today: string, labels: KhairatCsvLabels): string {
  return toCsv([
    labels.headers,
    ...rows.map((row) => [
      safeCell(row.head_name),
      String(row.year),
      String(row.people),
      senToPlain(dueSen(row)),
      senToPlain(row.paid_sen),
      senToPlain(owedSen(row)),
      labels.status[statusOf(row, today)],
      senToPlain(earlier.get(row.household_id) ?? 0),
    ]),
  ]);
}

/** Turns the database's refusals into keys under "errors" in messages/*.json. */
export function khairatError(error: { code?: string; message?: string } | null): string {
  const message = error?.message ?? "";
  if (message.includes("not on this plan")) return "khairat_plan";
  if (message.includes("more than what is owed")) return "khairat_overpaid";
  if (message.includes("membership has ended")) return "khairat_ended";
  if (message.includes("no setup for this year")) return "khairat_no_setup";
  if (message.includes("member not found")) return "not_found";
  if (message.includes("reason is required")) return "reason_missing";
  if (message.includes("pay_by_in_year")) return "khairat_pay_by";
  if (message.includes("locked period")) return "locked_month";
  if (message.includes("in the future")) return "date_future";
  if (message.includes("fund is archived")) return "fund_archived";
  if (error?.code === "23505") return "khairat_year_taken";
  if (error?.code === "42501") return "not_allowed";
  return "generic";
}
