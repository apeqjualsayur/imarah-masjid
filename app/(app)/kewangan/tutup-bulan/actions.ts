"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { currentMonth, parseMonth } from "@/lib/cashbook";
import { canLockMonth, monthStart, periodError, UNLOCK_REASON_MAX } from "@/lib/periods";
import { requireMember } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

export type PeriodState = { error?: string; reason?: string; n?: number };

function refresh(month: string) {
  revalidatePath("/kewangan/tutup-bulan");
  revalidatePath(`/kewangan/tutup-bulan/${month}`);
  revalidatePath("/kewangan");
}

/** Locks a month. The database checks again that it has ended and has no pending collections. */
export async function lockMonth(monthInput: string, prev: PeriodState, form: FormData): Promise<PeriodState> {
  await requireMember("periods.lock");
  const n = (prev.n ?? 0) + 1;
  const month = parseMonth(monthInput);
  if (!month) return { error: "not_found", n };
  if (!canLockMonth(month, currentMonth())) return { error: "period_not_ended", n };
  if (form.get("warnings") === "1" && form.get("understood") !== "on") return { error: "period_warnings_unread", n };

  const supabase = await createClient();
  const { error } = await supabase.rpc("lock_month", { p_month: monthStart(month) });
  if (error) return { error: periodError(error), n };
  refresh(month);
  redirect(`/kewangan/tutup-bulan/${month}?ok=dikunci`);
}

/** Unlocks a month with a typed reason, kept in the audit log. */
export async function unlockMonth(monthInput: string, prev: PeriodState, form: FormData): Promise<PeriodState> {
  await requireMember("periods.lock");
  const n = (prev.n ?? 0) + 1;
  const month = parseMonth(monthInput);
  if (!month) return { error: "not_found", n };
  const reason = String(form.get("reason") ?? "").trim().replace(/\s+/g, " ");
  if (!reason) return { error: "period_reason_missing", reason, n };
  if (reason.length > UNLOCK_REASON_MAX) return { error: "period_reason_too_long", reason, n };

  const supabase = await createClient();
  const { error } = await supabase.rpc("unlock_month", { p_month: monthStart(month), p_reason: reason });
  if (error) return { error: periodError(error), reason, n };
  refresh(month);
  redirect(`/kewangan/tutup-bulan/${month}?ok=dibuka`);
}
