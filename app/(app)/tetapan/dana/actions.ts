"use server";

import { revalidatePath } from "next/cache";
import { cashbookError, FUND_NAME_MAX } from "@/lib/cashbook";
import { checkPlanLimit } from "@/lib/plan-limits";
import { requireMember } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

export type FundState = { error?: string; limit?: number; done?: boolean; n?: number };

const name = (form: FormData) => String(form.get("name") ?? "").trim().replace(/\s+/g, " ");

function refresh() {
  revalidatePath("/tetapan/dana");
  revalidatePath("/kewangan", "layout");
  revalidatePath("/");
}

function checkName(value: string) {
  if (!value) return "name_missing";
  if (value.length > FUND_NAME_MAX) return "fund_name_too_long";
  return null;
}

export async function addFund(prev: FundState, form: FormData): Promise<FundState> {
  const { masjid } = await requireMember("funds.manage");
  const n = (prev.n ?? 0) + 1;
  const value = name(form);
  const problem = checkName(value);
  if (problem) return { error: problem, n };

  const supabase = await createClient();
  const limit = await checkPlanLimit(supabase, masjid, "funds", 1);
  if (!limit.allowed) return { error: "plan_limit_funds", limit: limit.limit ?? undefined, n };

  const { error } = await supabase.from("funds").insert({ name: value, restricted: form.get("restricted") === "on" });
  if (error) return { error: cashbookError(error), n };
  refresh();
  return { done: true, n };
}

export async function updateFund(id: string, prev: FundState, form: FormData): Promise<FundState> {
  await requireMember("funds.manage");
  const n = (prev.n ?? 0) + 1;
  const value = name(form);
  const problem = checkName(value);
  if (problem) return { error: problem, n };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("funds")
    .update({ name: value, restricted: form.get("restricted") === "on" })
    .eq("id", id)
    .select("id");
  if (error || !data?.length) return { error: cashbookError(error), n };
  refresh();
  return { done: true, n };
}

/** Archiving needs a zero balance (the database checks). Bringing one back counts against the plan again. */
export async function setFundArchived(id: string, archived: boolean): Promise<FundState> {
  const { masjid } = await requireMember("funds.manage");
  const supabase = await createClient();

  if (!archived) {
    const limit = await checkPlanLimit(supabase, masjid, "funds", 1);
    if (!limit.allowed) return { error: "plan_limit_funds", limit: limit.limit ?? undefined };
  }

  const { data, error } = await supabase
    .from("funds")
    .update({ archived_at: archived ? new Date().toISOString() : null })
    .eq("id", id)
    .select("id");
  if (error || !data?.length) return { error: cashbookError(error) };
  refresh();
  return { done: true };
}

export async function addCategory(prev: FundState, form: FormData): Promise<FundState> {
  await requireMember("funds.manage");
  const n = (prev.n ?? 0) + 1;
  const value = name(form);
  const problem = checkName(value);
  if (problem) return { error: problem, n };
  const type = form.get("type");
  if (type !== "income" && type !== "expense") return { error: "generic", n };

  const supabase = await createClient();
  const { error } = await supabase.from("categories").insert({ name: value, type });
  if (error) return { error: cashbookError(error), n };
  refresh();
  return { done: true, n };
}

export async function renameCategory(id: string, prev: FundState, form: FormData): Promise<FundState> {
  await requireMember("funds.manage");
  const n = (prev.n ?? 0) + 1;
  const value = name(form);
  const problem = checkName(value);
  if (problem) return { error: problem, n };

  const supabase = await createClient();
  const { data, error } = await supabase.from("categories").update({ name: value }).eq("id", id).select("id");
  if (error || !data?.length) return { error: cashbookError(error), n };
  refresh();
  return { done: true, n };
}

export async function setCategoryArchived(id: string, archived: boolean): Promise<FundState> {
  await requireMember("funds.manage");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("categories")
    .update({ archived_at: archived ? new Date().toISOString() : null })
    .eq("id", id)
    .select("id");
  if (error || !data?.length) return { error: cashbookError(error) };
  refresh();
  return { done: true };
}
