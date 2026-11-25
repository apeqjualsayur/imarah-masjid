import { beforeAll, describe, expect, it } from "vitest";
import { admin, anon, TABLES, userClient } from "./helpers";

type Coverage = {
  table_name: string;
  rls_enabled: boolean;
  has_audit_trigger: boolean;
  policy_count: number;
};

// Rule 9 in CLAUDE.md: every table ships with row security, an audit trigger
// and an isolation test. This reads the real table list, so a new table fails
// here until all three exist.
describe("every table in the database is covered", () => {
  let tables: Coverage[];

  beforeAll(async () => {
    const { data, error } = await admin.rpc("security_coverage");
    if (error) throw new Error(error.message);
    tables = data;
  });

  it("every table has isolation tests", () => {
    expect(tables.map((table) => table.table_name).sort()).toEqual([...TABLES].sort());
  });

  it("every table has row security on", () => {
    expect(tables.filter((table) => !table.rls_enabled)).toEqual([]);
  });

  it("every table has at least one access rule", () => {
    expect(tables.filter((table) => table.policy_count === 0)).toEqual([]);
  });

  it("every table except the log itself has the audit trigger", () => {
    const missing = tables.filter((table) => !table.has_audit_trigger).map((table) => table.table_name);
    expect(missing).toEqual(["audit_log"]);
  });

  it("the coverage list is not open to app users", async () => {
    const client = await userClient("a", "pengerusi");
    expect((await client.rpc("security_coverage")).error).not.toBeNull();
    expect((await anon.rpc("security_coverage")).error).not.toBeNull();
  });
});
