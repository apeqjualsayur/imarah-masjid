import { describe, expect, it } from "vitest";
import { allowedItems, sidebarItems, tabItems } from "@/components/shell/nav";
import { can, PERMISSIONS, ROLES, type Capability, type Role } from "@/lib/permissions";

// Written out again by hand from _specs/roles-permissions.md, so a slip in
// lib/permissions.ts shows up here. Order: Pengerusi, Bendahari, Setiausaha, AJK, Imam.
const spec: Record<Capability, string> = {
  "dashboard.view": "YYYYY",
  "dashboard.balances": "YYYY-",
  "finance.view": "YYYY-",
  "kariah.view": "YYYY-",
  "kariah.edit": "--Y--",
  "khairat.view": "YYYY-",
  "khairat.record": "-YY--",
  "khairat.setup": "YY---",
  "transactions.record": "-Y---",
  "transactions.reverse": "YY---",
  "funds.manage": "YY---",
  "collections.count": "-Y-Y-",
  "collections.confirm": "YY-Y-",
  "receipts.view": "YYYY-",
  "receipts.share": "YY---",
  "bank.view": "YY---",
  "bank.match": "-Y---",
  "periods.view": "YY---",
  "periods.lock": "Y----",
  "reports.prepare": "YYY--",
  "reports.download": "YYY--",
  "audit.view": "YY---",
  "audit.export": "Y----",
  "users.manage": "Y----",
  "settings.manage": "Y----",
  "plan.view": "Y----",
};

describe("permissions", () => {
  it("covers every capability in the spec and nothing else", () => {
    expect(Object.keys(PERMISSIONS).sort()).toEqual(Object.keys(spec).sort());
  });

  it.each(Object.entries(spec))("%s matches the spec", (capability, row) => {
    const actual = ROLES.map((role) => (can(role, capability as Capability) ? "Y" : "-")).join("");
    expect(actual).toBe(row);
  });

  it("no role means no access", () => {
    expect(can(null, "dashboard.view")).toBe(false);
    expect(can(undefined, "dashboard.view")).toBe(false);
  });
});

describe("menus", () => {
  const keys = (role: Role) => allowedItems(sidebarItems, role).map((item) => item.key);

  it("Pengerusi sees every menu item", () => {
    expect(keys("pengerusi")).toEqual(["utama", "kewangan", "kariah", "khairat", "derma", "laporan", "tetapan"]);
  });

  it("AJK has no reports", () => {
    expect(keys("ajk")).toEqual(["utama", "kewangan", "kariah", "khairat", "derma", "tetapan"]);
  });

  it("Imam sees only the home page, Terima derma and settings", () => {
    expect(keys("imam")).toEqual(["utama", "derma", "tetapan"]);
    expect(allowedItems(tabItems, "imam").map((item) => item.key)).toEqual(["utama", "lagi"]);
  });

  it.each(ROLES)("%s always has the home page and settings", (role) => {
    expect(keys(role)).toEqual(expect.arrayContaining(["utama", "tetapan"]));
  });
});
