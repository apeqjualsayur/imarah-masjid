import { describe, expect, it } from "vitest";
import { firstRowId, OPEN_DATE, type Role, type Row } from "../../scripts/seed-data";
import { PERMISSION_DENIED, TABLES, userClient, userId } from "./helpers";

const P = "pengerusi";
const B = "bendahari";
const S = "setiausaha";
const A = "ajk";
const I = "imam";

const ROLES: Role[] = [P, B, S, A, I];

// Who can read each table, from the plan table and _specs/roles-permissions.md.
const readers: Record<string, Role[]> = {
  audit_log: [P, B],
  bank_lines: [P, B],
  categories: [P, B, S, A],
  collections: [P, B, S, A],
  funds: [P, B, S, A, I],
  households: [P, B, S, A],
  invitations: [P],
  khairat_members: [P, B, S, A],
  khairat_plans: [P, B, S, A],
  masjids: [P, B, S, A, I],
  members: [P, B, S, A],
  memberships: [P, B, S, A, I],
  periods: [P, B, S, A, I],
  receipt_counters: [P, B],
  reports: [P, B, S],
  transactions: [P, B, S, A],
};

describe.each(TABLES)("reading %s in the user's own masjid", (table) => {
  it.each(ROLES)("%s", async (role) => {
    const client = await userClient("a", role);
    const { data, error } = await client.from(table).select("*").limit(1);
    expect(error).toBeNull();
    // Every table has seed rows, so an empty result means no access.
    expect((data ?? []).length > 0).toBe(readers[table].includes(role));
  });
});

type Attempt = {
  name: string;
  allowed: Role[];
  table: string;
  row: (role: Role) => Promise<Row> | Row;
};

const fund = () => firstRowId("a", "funds");
const unique = () => crypto.randomUUID();

// One row of the permissions table per attempt. Each adds a fresh row.
const attempts: Attempt[] = [
  {
    name: "add a kariah household",
    allowed: [S],
    table: "households",
    row: () => ({ head_name: `Ketua ${unique()}` }),
  },
  {
    name: "record a receipt or payment",
    allowed: [B],
    table: "transactions",
    row: () => ({ fund_id: fund(), amount_sen: 500, direction: "in", date: OPEN_DATE, method: "cash" }),
  },
  {
    name: "enter a Friday count",
    allowed: [B, A],
    table: "collections",
    row: async (role) => ({
      fund_id: fund(),
      date: OPEN_DATE,
      total_sen: 500,
      counted_by: await userId("a", role),
    }),
  },
  {
    name: "add a fund",
    allowed: [P, B],
    table: "funds",
    row: () => ({ name: `Tabung ${unique()}` }),
  },
  {
    name: "add a category",
    allowed: [P, B],
    table: "categories",
    row: () => ({ name: `Kategori ${unique()}`, type: "income" }),
  },
  {
    name: "import a bank line",
    allowed: [B],
    table: "bank_lines",
    row: () => ({ date: OPEN_DATE, amount_sen: 500, description: "Contoh" }),
  },
  {
    name: "invite a user",
    allowed: [P],
    table: "invitations",
    row: () => ({ email: `jemput-${unique()}@imarah.test`, role: "ajk", token_hash: unique() }),
  },
  {
    name: "prepare a report",
    allowed: [P, B, S],
    table: "reports",
    row: () => ({ type: "contoh", period: "2026-10", storage_path: `contoh/${unique()}.pdf` }),
  },
];

describe.each(attempts)("$name", ({ allowed, table, row }) => {
  it.each(ROLES)("%s", async (role) => {
    const client = await userClient("a", role);
    const { error } = await client.from(table).insert(await row(role));
    if (allowed.includes(role)) expect(error).toBeNull();
    else expect(error?.code).toBe(PERMISSION_DENIED);
  });
});

describe("writes with no direct route", () => {
  it.each(ROLES)("%s cannot change receipt counters directly", async (role) => {
    const client = await userClient("a", role);
    const { error } = await client
      .from("receipt_counters")
      .update({ last_no: 999 })
      .eq("id", firstRowId("a", "receipt_counters"))
      .select();
    expect(error?.code).toBe(PERMISSION_DENIED);
  });

  it.each([B, S, A, I] as Role[])("%s cannot change memberships", async (role) => {
    const client = await userClient("a", role);
    const { data, error } = await client
      .from("memberships")
      .update({ role: "pengerusi" })
      .eq("user_id", await userId("a", role))
      .select();
    if (error) expect(error.code).toBe(PERMISSION_DENIED);
    else expect(data).toEqual([]);
  });

  it.each([B, S, A, I] as Role[])("%s cannot revoke an invitation", async (role) => {
    const client = await userClient("a", role);
    const { data, error } = await client
      .from("invitations")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", firstRowId("a", "invitations"))
      .select();
    if (error) expect(error.code).toBe(PERMISSION_DENIED);
    else expect(data).toEqual([]);
  });

  it.each([B, S, A, I] as Role[])("%s cannot change masjid settings", async (role) => {
    const client = await userClient("a", role);
    const { data, error } = await client
      .from("masjids")
      .update({ address: "ubah" })
      .eq("id", firstRowId("a", "masjids"))
      .select();
    if (error) expect(error.code).toBe(PERMISSION_DENIED);
    else expect(data).toEqual([]);
  });
});
