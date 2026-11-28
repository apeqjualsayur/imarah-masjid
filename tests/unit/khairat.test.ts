import { describe, expect, it } from "vitest";
import {
  arrearsSen,
  dueSen,
  earlierArrears,
  khairatCsv,
  khairatError,
  owedSen,
  statusOf,
  summarise,
  type Membership,
} from "@/lib/khairat";
import { planHasFeature } from "@/lib/plan-limits";

const member = (overrides: Partial<Membership> = {}): Membership => ({
  id: "m1",
  household_id: "h1",
  head_name: "Ahmad",
  year: 2026,
  fee_sen: 5_000,
  people: 1,
  paid_sen: 0,
  pay_by: "2026-03-31",
  ended_at: null,
  ...overrides,
});

describe("what a household owes", () => {
  it("per household: the fee", () => {
    expect(dueSen(member())).toBe(5_000);
  });

  it("per person: the fee times the people covered", () => {
    expect(dueSen(member({ people: 4 }))).toBe(20_000);
  });

  it("partial payments leave the rest owed", () => {
    expect(owedSen(member({ paid_sen: 2_000 }))).toBe(3_000);
    expect(owedSen(member({ paid_sen: 4_999 }))).toBe(1);
  });

  it("never owes less than zero, even if the fee was lowered after paying", () => {
    expect(owedSen(member({ paid_sen: 6_000 }))).toBe(0);
  });
});

describe("status", () => {
  it("paid in full is aktif, before and after the last day to pay", () => {
    expect(statusOf(member({ paid_sen: 5_000 }), "2026-01-10")).toBe("aktif");
    expect(statusOf(member({ paid_sen: 5_000 }), "2026-11-28")).toBe("aktif");
  });

  it("not paid is still aktif up to and on the last day to pay", () => {
    expect(statusOf(member(), "2026-03-30")).toBe("aktif");
    expect(statusOf(member(), "2026-03-31")).toBe("aktif");
  });

  it("not paid in full after the last day to pay is tunggakan", () => {
    expect(statusOf(member(), "2026-04-01")).toBe("tunggakan");
    expect(statusOf(member({ paid_sen: 4_999 }), "2026-04-01")).toBe("tunggakan");
  });

  it("an ended membership is tamat and owes no arrears", () => {
    const ended = member({ ended_at: "2026-05-01T00:00:00Z" });
    expect(statusOf(ended, "2026-11-28")).toBe("tamat");
    expect(arrearsSen(ended, "2026-11-28")).toBe(0);
  });

  it("arrears count only after the last day to pay", () => {
    expect(arrearsSen(member({ paid_sen: 2_000 }), "2026-03-31")).toBe(0);
    expect(arrearsSen(member({ paid_sen: 2_000 }), "2026-04-01")).toBe(3_000);
  });
});

describe("summary for a year", () => {
  const today = "2026-11-28";
  const rows = [
    member({ id: "a", paid_sen: 5_000 }),
    member({ id: "b", household_id: "h2", paid_sen: 2_000 }),
    member({ id: "c", household_id: "h3", people: 3 }),
    member({ id: "d", household_id: "h4", ended_at: "2026-06-01T00:00:00Z", paid_sen: 1_000 }),
  ];

  it("counts members by status and adds up arrears", () => {
    expect(summarise(rows, today)).toEqual({
      members: 3,
      aktif: 1,
      tunggakan: 2,
      tamat: 1,
      due_sen: 5_000 + 5_000 + 15_000,
      paid_sen: 8_000,
      arrears_sen: 3_000 + 15_000,
    });
  });

  it("an empty year is all zero", () => {
    expect(summarise([], today)).toEqual({ members: 0, aktif: 0, tunggakan: 0, tamat: 0, due_sen: 0, paid_sen: 0, arrears_sen: 0 });
  });
});

describe("arrears from earlier years", () => {
  const today = "2026-11-28";
  const rows = [
    member({ id: "2024", year: 2024, pay_by: "2024-03-31", paid_sen: 1_000 }),
    member({ id: "2025", year: 2025, pay_by: "2025-03-31", paid_sen: 3_000 }),
    member({ id: "2026", year: 2026 }),
    member({ id: "other", household_id: "h2", year: 2025, pay_by: "2025-03-31", paid_sen: 5_000 }),
    member({ id: "ended", household_id: "h3", year: 2025, pay_by: "2025-03-31", ended_at: "2025-06-01T00:00:00Z" }),
  ];

  it("adds up unpaid earlier years per household, leaving out this year and ended ones", () => {
    const earlier = earlierArrears(rows, 2026, today);
    expect(earlier.get("h1")).toBe(4_000 + 2_000);
    expect(earlier.has("h2")).toBe(false);
    expect(earlier.has("h3")).toBe(false);
  });

  it("a payment for one year never lowers another year's balance", () => {
    const paid2025 = rows.map((row) => (row.id === "2025" ? { ...row, paid_sen: 5_000 } : row));
    const this2026 = paid2025.find((row) => row.id === "2026")!;
    expect(owedSen(this2026)).toBe(5_000);
    expect(earlierArrears(paid2025, 2026, today).get("h1")).toBe(4_000);
  });
});

describe("CSV", () => {
  it("plain numbers, status in words, earlier arrears, and names Excel cannot run", () => {
    const csv = khairatCsv(
      [member({ head_name: "=HYPERLINK(1)", paid_sen: 2_000 })],
      new Map([["h1", 1_500]]),
      "2026-11-28",
      {
        headers: ["Ketua", "Tahun", "Orang", "Yuran", "Dibayar", "Baki", "Status", "Lepas"],
        status: { aktif: "Aktif", tunggakan: "Tunggakan", tamat: "Tamat" },
      },
    );
    const lines = csv.replace(/^﻿/, "").trim().split(/\r?\n/);
    expect(lines[0]).toBe("Ketua,Tahun,Orang,Yuran,Dibayar,Baki,Status,Lepas");
    expect(lines[1]).toBe("'=HYPERLINK(1),2026,1,50.00,20.00,30.00,Tunggakan,15.00");
  });
});

describe("database messages", () => {
  it.each([
    ["khairat: more than what is owed for 2026", "khairat_overpaid"],
    ["khairat: this membership has ended", "khairat_ended"],
    ["khairat: no setup for this year", "khairat_no_setup"],
    ["khairat: not on this plan", "khairat_plan"],
    ['new row violates check constraint "khairat_plans_pay_by_in_year"', "khairat_pay_by"],
  ])("%s", (message, key) => {
    expect(khairatError({ message })).toBe(key);
  });

  it("a second setup for the same year", () => {
    expect(khairatError({ code: "23505", message: "duplicate key" })).toBe("khairat_year_taken");
  });
});

describe("plan", () => {
  it("khairat is not on Asas, and is on Standard and Pro", () => {
    expect(planHasFeature("asas", "khairat")).toBe(false);
    expect(planHasFeature("standard", "khairat")).toBe(true);
    expect(planHasFeature("pro", "khairat")).toBe(true);
  });
});
