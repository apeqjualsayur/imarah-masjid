import { describe, expect, it } from "vitest";
import { auditChanges, auditKind, auditValue, dayRange, groupOf, isAuditAction, isAuditGroup } from "@/lib/audit";
import { canLockMonth, lockChecklist, periodError, recentMonths } from "@/lib/periods";

describe("which months can be locked", () => {
  it("only months that have ended", () => {
    expect(canLockMonth("2026-10", "2026-11")).toBe(true);
    expect(canLockMonth("2026-11", "2026-11")).toBe(false);
    expect(canLockMonth("2026-12", "2026-11")).toBe(false);
    expect(canLockMonth("2025-12", "2026-01")).toBe(true);
  });

  it("lists the current month and twelve before it", () => {
    const months = recentMonths("2026-02", 12);
    expect(months).toHaveLength(13);
    expect(months[0]).toBe("2026-02");
    expect(months[1]).toBe("2026-01");
    expect(months[12]).toBe("2025-02");
  });
});

describe("lockChecklist", () => {
  const clean = { pendingCollections: 0, unmatchedBankLines: 0, unmatchedEntries: 0, bankDifferenceSen: 0, hasBankLines: true };

  it("is all clear for a reconciled month", () => {
    const result = lockChecklist(clean);
    expect(result.blocked).toBe(false);
    expect(result.warnings).toBe(0);
    expect(result.items.every((item) => item.state === "ok")).toBe(true);
  });

  it("blocks on a pending collection", () => {
    const result = lockChecklist({ ...clean, pendingCollections: 2 });
    expect(result.blocked).toBe(true);
    expect(result.items.find((item) => item.key === "collections")).toMatchObject({ state: "block", count: 2 });
  });

  it("only warns about the bank", () => {
    const result = lockChecklist({ ...clean, unmatchedBankLines: 1, unmatchedEntries: 3, bankDifferenceSen: -500 });
    expect(result.blocked).toBe(false);
    expect(result.warnings).toBe(3);
  });

  it("warns when there are bank entries but no statement", () => {
    const result = lockChecklist({ ...clean, hasBankLines: false, unmatchedEntries: 4, bankDifferenceSen: -9_000 });
    expect(result.items.map((item) => [item.key, item.state])).toEqual([
      ["collections", "ok"],
      ["noStatement", "warn"],
      ["bankLines", "ok"],
      ["bankDifference", "ok"],
      ["entries", "ok"],
      ["drafts", "ok"],
    ]);
  });

  it("says nothing about the bank for a cash-only month", () => {
    expect(lockChecklist({ ...clean, hasBankLines: false }).warnings).toBe(0);
  });
});

describe("periodError", () => {
  it.each([
    ["periods: pending collections", "period_pending_collections"],
    ["periods: month has not ended", "period_not_ended"],
    ["periods: already locked", "period_already_locked"],
    ["periods: month is not locked", "period_not_locked"],
    ["periods: unlocking a month needs a reason", "period_reason_missing"],
    ["periods: the reason is too long", "period_reason_too_long"],
    ["something else", "generic"],
  ])("%s", (message, key) => {
    expect(periodError({ message })).toBe(key);
  });

  it("knows a permission refusal", () => {
    expect(periodError({ code: "42501", message: "not_allowed" })).toBe("not_allowed");
  });
});

describe("audit values", () => {
  it.each([
    ["amount_sen", 5_000, { kind: "money", sen: 5_000 }],
    ["date", "2026-10-15", { kind: "date", date: "2026-10-15" }],
    ["locked_at", "2026-10-15T01:02:03Z", { kind: "time", iso: "2026-10-15T01:02:03Z" }],
    ["fund_id", "f1", { kind: "ref", to: "funds", id: "f1" }],
    ["category_id", "c1", { kind: "ref", to: "categories", id: "c1" }],
    ["created_by", "u1", { kind: "ref", to: "users", id: "u1" }],
    ["restricted", true, { kind: "bool", value: true }],
    ["phone", "[hidden]", { kind: "hidden" }],
    ["phone", "[changed]", { kind: "changed" }],
    ["note", null, { kind: "empty" }],
    ["note", "", { kind: "empty" }],
    ["description_columns", ["A", "B"], { kind: "text", text: "A, B" }],
  ])("%s %j", (field, raw, expected) => {
    expect(auditValue(field, raw)).toEqual(expected);
  });

  it("shortens very long text", () => {
    const value = auditValue("note", "x".repeat(500));
    expect(value.kind === "text" && value.text.length).toBe(160);
  });
});

describe("auditChanges", () => {
  it("shows only what changed, and skips bookkeeping columns", () => {
    const changes = auditChanges({
      action: "UPDATE",
      before: { id: "1", amount_sen: 5_000, note: "a", updated_at: "x", phone: "[hidden]" },
      after: { id: "1", amount_sen: 6_000, note: "a", updated_at: "y", phone: "[hidden]" },
    });
    expect(changes).toEqual([{ field: "amount_sen", before: { kind: "money", sen: 5_000 }, after: { kind: "money", sen: 6_000 } }]);
  });

  it("shows that a hidden field changed without its value", () => {
    const [change] = auditChanges({ action: "UPDATE", before: { phone: "[changed]" }, after: { phone: "[changed]" } });
    expect(change).toBeUndefined();
    const changes = auditChanges({ action: "UPDATE", before: { phone: "[hidden]" }, after: { phone: "[changed]" } });
    expect(changes[0].after).toEqual({ kind: "changed" });
  });

  it("lists what an added row was saved with, leaving out empty fields", () => {
    const changes = auditChanges({ action: "INSERT", before: null, after: { id: "1", masjid_id: "m", amount_sen: 100, note: null, line_hash: "h" } });
    expect(changes.map((change) => change.field)).toEqual(["amount_sen"]);
    expect(changes[0].before).toBeUndefined();
  });

  it("lists what a removed row held", () => {
    const changes = auditChanges({ action: "DELETE", before: { name: "Tabung" }, after: null });
    expect(changes).toEqual([{ field: "name", before: { kind: "text", text: "Tabung" } }]);
  });

  it("has nothing for views and emails", () => {
    expect(auditChanges({ action: "VIEW", before: null, after: null })).toEqual([]);
    expect(auditChanges({ action: "EMAIL", before: null, after: null })).toEqual([]);
  });
});

describe("auditKind", () => {
  const period = (action: string, before: object | null, after: object | null) => ({ table_name: "periods", action, before: before as never, after: after as never });

  it("names locks and unlocks", () => {
    expect(auditKind(period("INSERT", null, { locked_at: "t" }))).toBe("lock");
    expect(auditKind(period("UPDATE", { locked_at: null }, { locked_at: "t" }))).toBe("lock");
    expect(auditKind(period("UPDATE", { locked_at: "t" }, { locked_at: null, unlock_reason: "x" }))).toBe("unlock");
  });

  it("uses the plain action elsewhere", () => {
    expect(auditKind({ table_name: "transactions", action: "INSERT", before: null, after: {} })).toBe("insert");
    expect(auditKind({ table_name: "masjids", action: "VIEW", before: null, after: null })).toBe("view");
  });
});

describe("audit filters", () => {
  it("groups every table", () => {
    expect(groupOf("transactions")).toBe("kewangan");
    expect(groupOf("bank_imports")).toBe("bank");
    expect(groupOf("periods")).toBe("bulan");
    expect(groupOf("unknown")).toBeNull();
  });

  it("accepts only known groups and actions", () => {
    expect(isAuditGroup("kariah")).toBe(true);
    expect(isAuditGroup("drop table")).toBe(false);
    expect(isAuditAction("UPDATE")).toBe(true);
    expect(isAuditAction("update")).toBe(false);
  });

  it("filters whole days in Malaysian time", () => {
    expect(dayRange("2026-10-01", "2026-10-31")).toEqual({ from: "2026-10-01T00:00:00+08:00", to: "2026-10-31T23:59:59.999+08:00" });
    expect(dayRange(null, null)).toEqual({ from: null, to: null });
  });
});

describe("audit labels", () => {
  it("every grouped table has a name in both languages", async () => {
    const { AUDIT_GROUPS } = await import("@/lib/audit");
    const ms = (await import("@/messages/ms.json")).default.audit.tables as Record<string, string>;
    const en = (await import("@/messages/en.json")).default.audit.tables as Record<string, string>;
    for (const table of Object.values(AUDIT_GROUPS).flat()) {
      expect(ms[table], table).toBeTruthy();
      expect(en[table], table).toBeTruthy();
    }
  });
});
