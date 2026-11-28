"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isIsoDate, isMethod, REF_MAX, RECEIVED_FROM_MAX, todayInMalaysia } from "@/lib/cashbook";
import { END_REASON_MAX, isCoverage, khairatError } from "@/lib/khairat";
import { parseRinggit } from "@/lib/money";
import { planHasFeature } from "@/lib/plan-limits";
import { requireMember } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

const text = (form: FormData, name: string) => String(form.get(name) ?? "").trim();
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function refresh() {
  revalidatePath("/khairat", "layout");
  revalidatePath("/kewangan");
  revalidatePath("/");
}

// Yearly setup ------------------------------------------------------------------

export type PlanValues = { year: string; fee: string; coverage: string; pay_by: string; fund_id: string };
export type PlanState = { error?: string; values?: PlanValues; n?: number; saved?: boolean };

/** Adds or changes a year's setup. Pengerusi and Bendahari; paid plans only. */
export async function savePlan(prev: PlanState, form: FormData): Promise<PlanState> {
  const { masjid } = await requireMember("khairat.setup");
  const values: PlanValues = {
    year: text(form, "year"),
    fee: text(form, "fee"),
    coverage: text(form, "coverage"),
    pay_by: text(form, "pay_by"),
    fund_id: text(form, "fund_id"),
  };
  const n = (prev.n ?? 0) + 1;
  const refuse = (error: string): PlanState => ({ error, values, n });

  if (!planHasFeature(masjid.plan, "khairat")) return refuse("khairat_plan");
  const year = Number(values.year);
  if (!Number.isInteger(year) || year < 2000 || year > 2100) return refuse("khairat_year_bad");
  const fee = parseRinggit(values.fee);
  if (!fee.ok) return refuse(fee.error);
  if (!isCoverage(values.coverage)) return refuse("missing_fields");
  if (!isIsoDate(values.pay_by) || !values.pay_by.startsWith(`${year}-`)) return refuse("khairat_pay_by");
  if (!UUID.test(values.fund_id)) return refuse("fund_missing");

  const supabase = await createClient();
  const row = { fee_sen: fee.sen, coverage: values.coverage, pay_by: values.pay_by, fund_id: values.fund_id };
  const id = text(form, "id");
  const { error } = UUID.test(id)
    ? await supabase.from("khairat_plans").update(row).eq("id", id)
    : await supabase.from("khairat_plans").insert({ ...row, year });
  if (error) return refuse(khairatError(error));

  refresh();
  redirect(`/khairat?tahun=${year}&tetapan=ok`);
}

// Members -------------------------------------------------------------------------

export type EnrolState = { error?: string };

/** Enrols the ticked households for the year. */
export async function enrolHouseholds(year: number, _: EnrolState, form: FormData): Promise<EnrolState> {
  await requireMember("khairat.record");
  const ids = form.getAll("household").map(String).filter((id) => UUID.test(id));
  if (ids.length === 0) return { error: "khairat_none_chosen" };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("enrol_khairat", { p_year: year, p_household_ids: ids });
  if (error) return { error: khairatError(error) };

  refresh();
  redirect(`/khairat?tahun=${year}&didaftar=${Number(data ?? 0)}`);
}

/** Enrols everyone from last year who did not end. */
export async function renewFromLastYear(year: number): Promise<EnrolState> {
  await requireMember("khairat.record");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("renew_khairat", { p_year: year });
  if (error) return { error: khairatError(error) };

  refresh();
  redirect(`/khairat?tahun=${year}&didaftar=${Number(data ?? 0)}`);
}

export type EndState = { error?: string };

/** Ends a membership with a reason. */
export async function endMembership(id: string, _: EndState, form: FormData): Promise<EndState> {
  await requireMember("khairat.record");
  const reason = text(form, "reason").replace(/\s+/g, " ");
  if (!reason) return { error: "reason_missing" };
  if (reason.length > END_REASON_MAX) return { error: "reason_too_long" };

  const supabase = await createClient();
  const { error } = await supabase.rpc("end_khairat", { p_member_id: id, p_reason: reason });
  if (error) return { error: khairatError(error) };

  refresh();
  redirect(`/khairat/${id}`);
}

// Payments ----------------------------------------------------------------------

export type PaymentValues = { amount: string; date: string; method: string; ref_no: string; received_from: string };
export type PaymentState = { error?: string; values?: PaymentValues; n?: number };

/**
 * Records a payment through the database function, which posts the receipt
 * to the khairat fund and updates what the household has paid.
 */
export async function recordPayment(id: string, prev: PaymentState, form: FormData): Promise<PaymentState> {
  await requireMember("khairat.record");
  const values: PaymentValues = {
    amount: text(form, "amount"),
    date: text(form, "date"),
    method: text(form, "method"),
    ref_no: text(form, "ref_no"),
    received_from: text(form, "received_from").replace(/\s+/g, " "),
  };
  const n = (prev.n ?? 0) + 1;
  const refuse = (error: string): PaymentState => ({ error, values, n });

  const amount = parseRinggit(values.amount);
  if (!amount.ok) return refuse(amount.error);
  if (!isIsoDate(values.date)) return refuse("date_bad");
  if (values.date > todayInMalaysia()) return refuse("date_future");
  if (!isMethod(values.method)) return refuse("method_missing");
  if (values.ref_no.length > REF_MAX) return refuse("ref_too_long");
  if (values.received_from.length > RECEIVED_FROM_MAX) return refuse("received_from_too_long");

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("record_khairat_payment", {
    p_member_id: id,
    p_amount_sen: amount.sen,
    p_date: values.date,
    p_method: values.method,
    p_ref_no: values.ref_no || null,
    p_received_from: values.received_from || null,
  });
  if (error || !data) return refuse(khairatError(error));

  refresh();
  redirect(`/khairat/${id}?dibayar=${data}`);
}
