import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import type { Coverage, Membership } from "@/lib/khairat";
import type { Capability } from "@/lib/permissions";
import { planHasFeature } from "@/lib/plan-limits";
import { requireMember } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

/** For khairat sub-pages: the role check, then the plan check (Asas goes to the upgrade message). */
export async function requireKhairat(capability: Capability) {
  const context = await requireMember(capability);
  if (!planHasFeature(context.masjid.plan, "khairat")) redirect("/khairat");
  return context;
}

export type KhairatPlan = {
  id: string;
  year: number;
  fee_sen: number;
  coverage: Coverage;
  pay_by: string;
  fund_id: string;
};

export type MembershipRow = Membership & { plan_id: string; end_reason: string | null };

/** The masjid's yearly setups, newest first. */
export const loadPlans = cache(async (): Promise<KhairatPlan[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("khairat_plans")
    .select("id, year, fee_sen, coverage, pay_by, fund_id")
    .order("year", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((plan) => ({ ...plan, fee_sen: Number(plan.fee_sen) })) as KhairatPlan[];
});

type Raw = {
  id: string;
  household_id: string;
  plan_id: string;
  people: number;
  paid_sen: number;
  ended_at: string | null;
  end_reason: string | null;
  households: { head_name: string } | null;
};

/** Every membership, all years, with its household's name and its year's setup. */
export const loadMemberships = cache(async (): Promise<MembershipRow[]> => {
  const supabase = await createClient();
  const [plans, { data, error }] = await Promise.all([
    loadPlans(),
    supabase
      .from("khairat_members")
      .select("id, household_id, plan_id, people, paid_sen, ended_at, end_reason, households(head_name)")
      .limit(20000),
  ]);
  if (error) throw new Error(error.message);
  const byId = new Map(plans.map((plan) => [plan.id, plan]));

  return ((data ?? []) as unknown as Raw[])
    .flatMap((row) => {
      const plan = byId.get(row.plan_id);
      if (!plan) return [];
      return [
        {
          id: row.id,
          household_id: row.household_id,
          plan_id: row.plan_id,
          head_name: row.households?.head_name ?? "—",
          year: plan.year,
          fee_sen: plan.fee_sen,
          people: row.people,
          paid_sen: Number(row.paid_sen),
          pay_by: plan.pay_by,
          ended_at: row.ended_at,
          end_reason: row.end_reason,
        },
      ];
    })
    .sort((a, b) => a.head_name.localeCompare(b.head_name, "ms"));
});
