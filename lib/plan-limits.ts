// The one place that knows plan limits (_specs/phase1.md section 8). Steps 5
// and 6 check households and funds here in the app; Step 13 moves the hard
// limits into the database and adds lib/plans.ts.

import type { SupabaseClient } from "@supabase/supabase-js";

export type LimitedResource = "households" | "users" | "funds";

const LIMITS: Record<string, Partial<Record<LimitedResource, number>>> = {
  asas: { households: 150, users: 3, funds: 2 },
};

export function planLimit(plan: string, resource: LimitedResource): number | null {
  return LIMITS[plan]?.[resource] ?? null;
}

export type LimitCheck = { allowed: boolean; limit: number | null; used: number; room: number | null };

/** Pure check: would adding `adding` more go over the plan's limit? */
export function withinLimit(plan: string, resource: LimitedResource, used: number, adding = 1): LimitCheck {
  const limit = planLimit(plan, resource);
  if (limit === null) return { allowed: true, limit, used, room: null };
  return { allowed: used + adding <= limit, limit, used, room: Math.max(0, limit - used) };
}

const TABLES: Record<LimitedResource, string> = { households: "households", users: "memberships", funds: "funds" };

/**
 * Counts what the masjid already has (through RLS, so only its own rows) and
 * checks the limit. Used before adding households one by one or by import.
 */
export async function checkPlanLimit(
  supabase: SupabaseClient,
  masjid: { id: string; plan: string },
  resource: LimitedResource,
  adding = 1,
): Promise<LimitCheck> {
  if (planLimit(masjid.plan, resource) === null) return withinLimit(masjid.plan, resource, 0, adding);

  let query = supabase.from(TABLES[resource]).select("id", { count: "exact", head: true }).eq("masjid_id", masjid.id);
  if (resource === "users") query = query.eq("status", "active");
  // Archived funds have no money in them and cannot take entries, so only open ones count.
  if (resource === "funds") query = query.is("archived_at", null);
  const { count, error } = await query;
  if (error) throw new Error(`plan limit: ${error.message}`);
  return withinLimit(masjid.plan, resource, count ?? 0, adding);
}
