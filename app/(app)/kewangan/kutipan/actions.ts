"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isIsoDate, NOTE_MAX, REASON_MAX, todayInMalaysia } from "@/lib/cashbook";
import { breakdownTotal, collectionError, NOTES, type Breakdown } from "@/lib/collections";
import { MAX_SEN } from "@/lib/money";
import { requireMember } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BREAKDOWN_KEYS = new Set<string>([...NOTES.map(String), "coins_sen"]);

/** Checks an amount and optional breakdown sent from a form or the offline queue. */
function checkAmount(totalSen: unknown, breakdown: unknown): { ok: true; total: number; breakdown: Breakdown | null } | { ok: false; error: string } {
  if (typeof totalSen !== "number" || !Number.isSafeInteger(totalSen) || totalSen <= 0) return { ok: false, error: "amount_zero" };
  if (totalSen > MAX_SEN) return { ok: false, error: "amount_too_big" };
  if (breakdown === null || breakdown === undefined) return { ok: true, total: totalSen, breakdown: null };
  if (typeof breakdown !== "object" || Array.isArray(breakdown)) return { ok: false, error: "breakdown_mismatch" };
  for (const [key, value] of Object.entries(breakdown)) {
    if (!BREAKDOWN_KEYS.has(key) || !Number.isSafeInteger(value) || (value as number) < 0) return { ok: false, error: "breakdown_mismatch" };
  }
  if (breakdownTotal(breakdown as Breakdown) !== totalSen) return { ok: false, error: "breakdown_mismatch" };
  return { ok: true, total: totalSen, breakdown: breakdown as Breakdown };
}

function amountFromForm(form: FormData) {
  const total = Number(form.get("total_sen"));
  const raw = String(form.get("breakdown") ?? "");
  let breakdown: unknown = null;
  try {
    breakdown = raw ? JSON.parse(raw) : null;
  } catch {
    return { ok: false as const, error: "breakdown_mismatch" };
  }
  return checkAmount(total, breakdown);
}

export type CountInput = {
  key: string;
  date: string;
  fund_id: string;
  total_sen: number;
  breakdown: Breakdown | null;
  note: string;
};

export type CountResult = { ok: true; id: string } | { ok: false; error: string };

/**
 * Saves a count. Called by the count form and again by the offline queue;
 * the key makes a second send return the first count instead of saving twice.
 */
export async function submitCount(input: CountInput): Promise<CountResult> {
  await requireMember("collections.count");
  if (!UUID.test(input.key)) return { ok: false, error: "generic" };
  if (!isIsoDate(input.date)) return { ok: false, error: "date_bad" };
  if (input.date > todayInMalaysia()) return { ok: false, error: "date_future" };
  if (!UUID.test(input.fund_id)) return { ok: false, error: "fund_missing" };
  const amount = checkAmount(input.total_sen, input.breakdown);
  if (!amount.ok) return amount;
  const note = (input.note ?? "").trim();
  if (note.length > NOTE_MAX) return { ok: false, error: "note_too_long" };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("record_collection", {
    p_key: input.key,
    p_date: input.date,
    p_fund_id: input.fund_id,
    p_total_sen: amount.total,
    p_breakdown: amount.breakdown,
    p_note: note || null,
  });
  if (error || !data) return { ok: false, error: collectionError(error) };

  revalidatePath("/kewangan/kutipan");
  revalidatePath("/");
  return { ok: true, id: data as string };
}

export type StepState = { error?: string; n?: number };

/** The second person's own count. Matching posts the receipt; a difference marks it for checking. */
export async function confirmCount(id: string, prev: StepState, form: FormData): Promise<StepState> {
  await requireMember("collections.confirm");
  const n = (prev.n ?? 0) + 1;
  const amount = amountFromForm(form);
  if (!amount.ok) return { error: amount.error, n };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("confirm_collection", { p_id: id, p_total_sen: amount.total });
  if (error) return { error: collectionError(error), n };

  revalidatePath("/kewangan", "layout");
  revalidatePath("/");
  redirect(`/kewangan/kutipan/${id}?hasil=${data === "confirmed" ? "disahkan" : "semak"}`);
}

/** A fresh count. The person recounting becomes the counter, so someone else confirms. */
export async function recount(id: string, prev: StepState, form: FormData): Promise<StepState> {
  await requireMember("collections.count");
  const n = (prev.n ?? 0) + 1;
  const amount = amountFromForm(form);
  if (!amount.ok) return { error: amount.error, n };

  const supabase = await createClient();
  const { error } = await supabase.rpc("recount_collection", {
    p_id: id,
    p_total_sen: amount.total,
    p_breakdown: amount.breakdown,
  });
  if (error) return { error: collectionError(error), n };

  revalidatePath("/kewangan/kutipan");
  revalidatePath("/");
  redirect(`/kewangan/kutipan/${id}?hasil=dikira`);
}

export async function cancelCount(id: string, prev: StepState, form: FormData): Promise<StepState> {
  await requireMember("finance.view");
  const n = (prev.n ?? 0) + 1;
  const reason = String(form.get("reason") ?? "").trim().replace(/\s+/g, " ");
  if (!reason) return { error: "reason_missing", n };
  if (reason.length > REASON_MAX) return { error: "reason_too_long", n };

  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_collection", { p_id: id, p_reason: reason });
  if (error) return { error: collectionError(error), n };

  revalidatePath("/kewangan/kutipan");
  revalidatePath("/");
  redirect(`/kewangan/kutipan/${id}`);
}
