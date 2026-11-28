import { beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { firstRowId, masjidId, OPEN_DATE, type Role, type Row } from "../../scripts/seed-data";
import { admin, anon, firstAuditRowId, PERMISSION_DENIED, TABLES, userClient, userId } from "./helpers";

const MASJID_A = masjidId("a");
const MASJID_B = masjidId("b");
const FOREIGN_KEY_VIOLATION = "23503";

// A harmless change per table, for the update attempts.
const patches: Record<string, Row> = {
  audit_log: { table_name: "dicerobohi" },
  bank_lines: { description: "dicerobohi" },
  categories: { name: "dicerobohi" },
  collections: { total_sen: 1 },
  funds: { name: "dicerobohi" },
  households: { head_name: "dicerobohi" },
  invitations: { revoked_at: "2026-10-20T00:00:00Z" },
  khairat_members: { paid_sen: 1 },
  khairat_plans: { fee_sen: 1 },
  masjids: { name: "dicerobohi" },
  members: { name: "dicerobohi" },
  memberships: { status: "removed" },
  periods: { unlock_reason: "dicerobohi" },
  receipt_counters: { last_no: 999 },
  reports: { type: "dicerobohi" },
  transactions: { amount_sen: 1 },
};

// Attackers hold every role in masjid A, because a table's writer differs by
// role. A blocked role alone would not prove the masjid boundary.
const attackers: Role[] = ["pengerusi", "bendahari", "setiausaha", "ajk", "imam"];

async function targetId(table: string) {
  return table === "audit_log" ? firstAuditRowId(MASJID_B) : firstRowId("b", table);
}

async function readAsAdmin(table: string, id: string) {
  const { data, error } = await admin.from(table).select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  expect(data, `seed row missing in ${table}`).not.toBeNull();
  return data;
}

describe.each(attackers)("%s of masjid A against masjid B", (role) => {
  let client: SupabaseClient;

  beforeAll(async () => {
    client = await userClient("a", role);
  });

  describe.each(TABLES)("%s", (table) => {
    it("cannot read the row", async () => {
      const { data, error } = await client.from(table).select("*").eq("id", await targetId(table));
      expect(error).toBeNull();
      expect(data).toEqual([]);
    });

    it("sees no masjid B rows in a full listing", async () => {
      const column = table === "masjids" ? "id" : "masjid_id";
      const { data, error } = await client.from(table).select(column);
      expect(error).toBeNull();
      const rows = (data ?? []) as unknown as Row[];
      expect(rows.filter((row) => row[column] !== MASJID_A)).toEqual([]);
    });

    it("cannot insert a row", async () => {
      const source = await readAsAdmin(table, await targetId(table));
      // Move dated rows to an open month, so the locked-month rule cannot be
      // what blocks the insert. This test is about the masjid boundary.
      const payload = { ...source, id: crypto.randomUUID(), ...("date" in source ? { date: OPEN_DATE } : {}) };
      const { data, error } = await client.from(table).insert(payload).select();
      expect(data).toBeNull();
      expect(error?.code).toBe(PERMISSION_DENIED);
      const { data: leaked } = await admin.from(table).select("id").eq("id", payload.id);
      expect(leaked).toEqual([]);
    });

    it("cannot update the row", async () => {
      const id = await targetId(table);
      const before = await readAsAdmin(table, id);
      const { data, error } = await client.from(table).update(patches[table]).eq("id", id).select();
      if (error) expect(error.code).toBe(PERMISSION_DENIED);
      else expect(data).toEqual([]);
      expect(await readAsAdmin(table, id)).toEqual(before);
    });

    it("cannot delete the row", async () => {
      const id = await targetId(table);
      const before = await readAsAdmin(table, id);
      const { data, error } = await client.from(table).delete().eq("id", id).select();
      if (error) expect(error.code).toBe(PERMISSION_DENIED);
      else expect(data).toEqual([]);
      expect(await readAsAdmin(table, id)).toEqual(before);
    });
  });
});

describe("logged-out visitor", () => {
  it.each(TABLES)("gets nothing from %s", async (table) => {
    const { data, error } = await anon.from(table).select("*");
    expect(data).toBeNull();
    expect(error?.code).toBe(PERMISSION_DENIED);
  });
});

describe("links across masjids are refused", () => {
  it("transaction into masjid B's fund", async () => {
    const client = await userClient("a", "bendahari");
    const { error } = await client.from("transactions").insert({
      fund_id: firstRowId("b", "funds"),
      amount_sen: 100,
      direction: "in",
      date: "2026-10-20",
      method: "cash",
    });
    expect(error?.code).toBe(FOREIGN_KEY_VIOLATION);
  });

  it("transaction against masjid B's household", async () => {
    const client = await userClient("a", "bendahari");
    const { error } = await client.from("transactions").insert({
      fund_id: firstRowId("a", "funds"),
      household_id: firstRowId("b", "households"),
      amount_sen: 100,
      direction: "in",
      date: "2026-10-20",
      method: "cash",
    });
    expect(error?.code).toBe(FOREIGN_KEY_VIOLATION);
  });

  it("reversal of masjid B's transaction", async () => {
    const client = await userClient("a", "bendahari");
    const { error } = await client.from("transactions").insert({
      fund_id: firstRowId("a", "funds"),
      reverses_id: firstRowId("b", "transactions"),
      amount_sen: 100,
      direction: "out",
      date: "2026-10-20",
      method: "cash",
    });
    expect(error).not.toBeNull();
  });

  it("member added to masjid B's household", async () => {
    const client = await userClient("a", "setiausaha");
    const { error } = await client
      .from("members")
      .insert({ household_id: firstRowId("b", "households"), name: "Ahli Contoh" });
    expect(error?.code).toBe(FOREIGN_KEY_VIOLATION);
  });

  it("collection into masjid B's fund", async () => {
    const client = await userClient("a", "bendahari");
    const { error } = await client.rpc("record_collection", {
      p_key: crypto.randomUUID(),
      p_fund_id: firstRowId("b", "funds"),
      p_date: "2026-10-20",
      p_total_sen: 100,
    });
    expect(error?.message).toContain("choose an open fund");
    const direct = await client.from("collections").insert({
      fund_id: firstRowId("b", "funds"),
      date: "2026-10-20",
      total_sen: 100,
      counted_by: await userId("a", "bendahari"),
    });
    expect(direct.error?.code).toBe(PERMISSION_DENIED);
  });

  it("khairat membership on masjid B's plan", async () => {
    // Members are only written through the khairat functions (Step 9), which
    // take the masjid from the session; the table itself refuses app users.
    const client = await userClient("a", "bendahari");
    const { error } = await client.from("khairat_members").insert({
      household_id: firstRowId("a", "households"),
      plan_id: firstRowId("b", "khairat_plans"),
    });
    expect(error?.code).toBe(PERMISSION_DENIED);
    const { data } = await client.rpc("enrol_khairat", { p_year: 2026, p_household_ids: [firstRowId("b", "households")] });
    expect(data).toBe(0);
  });

  it("bank line matched to masjid B's transaction", async () => {
    const client = await userClient("a", "bendahari");
    const { error } = await client
      .from("bank_lines")
      .update({ matched_transaction_id: firstRowId("b", "transactions") })
      .eq("id", firstRowId("a", "bank_lines"));
    expect(error?.code).toBe(FOREIGN_KEY_VIOLATION);
  });
});
