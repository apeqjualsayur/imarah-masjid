import { describe, expect, it } from "vitest";
import { firstRowId, masjidId, OPEN_DATE, type Role } from "../../scripts/seed-data";
import { admin, anon, PERMISSION_DENIED, userClient } from "./helpers";

const MASJID_A = masjidId("a");
const FUND = () => firstRowId("a", "funds");
const CHECK_VIOLATION = "23514";

const entry = (overrides: Record<string, unknown> = {}) => ({
  fund_id: FUND(),
  amount_sen: 1_000,
  direction: "in",
  date: OPEN_DATE,
  method: "cash",
  ...overrides,
});

async function record(overrides: Record<string, unknown> = {}) {
  const { data, error } = await (await userClient("a", "bendahari")).from("transactions").insert(entry(overrides)).select().single();
  expect(error).toBeNull();
  return data;
}

const sequenceOf = (receiptNo: string) => Number(receiptNo.split("-")[2]);

describe("every receipt gets a number", () => {
  it("a receipt recorded by the Bendahari gets the next RC number for its year", async () => {
    const first = await record();
    const second = await record();
    expect(first.receipt_no).toMatch(/^RC-2026-\d{4,}$/);
    expect(sequenceOf(second.receipt_no)).toBe(sequenceOf(first.receipt_no) + 1);
  });

  it("the year comes from the entry's date", async () => {
    const old = await record({ date: "2025-12-20" });
    expect(old.receipt_no).toMatch(/^RC-2025-\d{4,}$/);
  });

  it("payments and cancellations get no number", async () => {
    const payment = await record({ direction: "out", category_id: null });
    expect(payment.receipt_no).toBeNull();

    const original = await record();
    const { data: reversal, error } = await (await userClient("a", "pengerusi"))
      .from("transactions")
      .insert(entry({ direction: "out", reverses_id: original.id, reversal_reason: "Ujian resit", date: OPEN_DATE }))
      .select()
      .single();
    expect(error).toBeNull();
    expect(reversal.receipt_no).toBeNull();
  });

  it("a cancelled receipt keeps its number and the number is never used again", async () => {
    const original = await record();
    await (await userClient("a", "pengerusi"))
      .from("transactions")
      .insert(entry({ direction: "out", reverses_id: original.id, reversal_reason: "Ujian resit", date: OPEN_DATE }));
    const next = await record();

    const { data: kept } = await admin.from("transactions").select("receipt_no").eq("id", original.id).single();
    expect(kept?.receipt_no).toBe(original.receipt_no);
    expect(sequenceOf(next.receipt_no)).toBe(sequenceOf(original.receipt_no) + 1);
  });

  it("an entry refused by the rules uses no number", async () => {
    const before = await record();
    const tomorrow = new Date(Date.now() + 36 * 3600 * 1000).toISOString().slice(0, 10);
    const refused = await (await userClient("a", "bendahari")).from("transactions").insert(entry({ date: tomorrow }));
    expect(refused.error).not.toBeNull();
    const after = await record();
    expect(sequenceOf(after.receipt_no)).toBe(sequenceOf(before.receipt_no) + 1);
  });

  it("receipts and Friday collections share one sequence", async () => {
    const before = await record();
    const ajk = await userClient("a", "ajk");
    const { data: id } = await ajk.rpc("record_collection", {
      p_key: crypto.randomUUID(),
      p_date: OPEN_DATE,
      p_fund_id: FUND(),
      p_total_sen: 3_000,
    });
    const confirmed = await (await userClient("a", "pengerusi")).rpc("confirm_collection", { p_id: id, p_total_sen: 3_000 });
    expect(confirmed.data).toBe("confirmed");
    const { data: count } = await admin.from("collections").select("transaction_id").eq("id", id).single();
    const { data: posted } = await admin.from("transactions").select("receipt_no").eq("id", count!.transaction_id).single();
    expect(sequenceOf(posted!.receipt_no)).toBe(sequenceOf(before.receipt_no) + 1);
  });
});

describe("two receipts at the same moment", () => {
  it("20 receipts saved at once get 20 different, consecutive numbers", async () => {
    const client = await userClient("a", "bendahari");
    const results = await Promise.all(
      Array.from({ length: 20 }, (_, i) => client.from("transactions").insert(entry({ amount_sen: 100 + i })).select("receipt_no").single()),
    );
    expect(results.map((result) => result.error)).toEqual(Array(20).fill(null));

    const numbers = results.map((result) => result.data!.receipt_no as string);
    expect(new Set(numbers).size).toBe(20);
    const sequence = numbers.map(sequenceOf).sort((a, b) => a - b);
    expect(sequence.at(-1)! - sequence[0]).toBe(19);
  });
});

describe("donor name", () => {
  it("is saved with the receipt", async () => {
    const saved = await record({ received_from: "Hamba Allah" });
    expect(saved.received_from).toBe("Hamba Allah");
  });

  it("over 100 characters is refused", async () => {
    const { error } = await (await userClient("a", "bendahari")).from("transactions").insert(entry({ received_from: "x".repeat(101) }));
    expect(error?.code).toBe(CHECK_VIOLATION);
  });

  it("is hidden in the audit log", async () => {
    const saved = await record({ received_from: "Nama Rahsia" });
    const { data } = await admin.from("audit_log").select("after").eq("table_name", "transactions").eq("row_id", saved.id).single();
    expect(data?.after.received_from).toBe("[hidden]");
    expect(JSON.stringify(data)).not.toContain("Nama Rahsia");
  });
});

describe("the Imarah credit setting", () => {
  it("the Pengerusi can change it", async () => {
    const { data, error } = await (await userClient("a", "pengerusi"))
      .from("masjids")
      .update({ receipt_hide_credit: true })
      .eq("id", MASJID_A)
      .select("receipt_hide_credit");
    expect(error).toBeNull();
    expect(data).toEqual([{ receipt_hide_credit: true }]);
    await admin.from("masjids").update({ receipt_hide_credit: false }).eq("id", MASJID_A);
  });

  it.each(["bendahari", "setiausaha", "ajk", "imam"] as Role[])("%s cannot", async (role) => {
    const { data } = await (await userClient("a", role)).from("masjids").update({ receipt_hide_credit: true }).eq("id", MASJID_A).select();
    expect(data ?? []).toEqual([]);
    const { data: row } = await admin.from("masjids").select("receipt_hide_credit").eq("id", MASJID_A).single();
    expect(row?.receipt_hide_credit).toBe(false);
  });

  it("masjid B's Pengerusi cannot change masjid A's", async () => {
    const { data } = await (await userClient("b", "pengerusi")).from("masjids").update({ receipt_hide_credit: true }).eq("id", MASJID_A).select();
    expect(data ?? []).toEqual([]);
  });
});

describe("noting an emailed receipt", () => {
  it.each(["pengerusi", "bendahari"] as Role[])("%s can, and only the fact is logged", async (role) => {
    const saved = await record();
    const { error } = await (await userClient("a", role)).rpc("log_receipt_emailed", { p_id: saved.id });
    expect(error).toBeNull();
    const { data } = await admin.from("audit_log").select("action, before, after").eq("row_id", saved.id).eq("action", "EMAIL");
    expect(data).toEqual([{ action: "EMAIL", before: null, after: null }]);
  });

  it.each(["setiausaha", "ajk", "imam"] as Role[])("%s cannot", async (role) => {
    const saved = await record();
    const { error } = await (await userClient("a", role)).rpc("log_receipt_emailed", { p_id: saved.id });
    expect(error?.code).toBe(PERMISSION_DENIED);
  });

  it("masjid B cannot note masjid A's receipt", async () => {
    const saved = await record();
    const { error } = await (await userClient("b", "bendahari")).rpc("log_receipt_emailed", { p_id: saved.id });
    expect(error?.message).toContain("not found");
  });

  it("the log cannot be filled for anonymous visitors", async () => {
    const saved = await record();
    const { error } = await anon.rpc("log_receipt_emailed", { p_id: saved.id });
    expect(error).not.toBeNull();
  });
});

describe("between masjids", () => {
  it("masjid B cannot read masjid A's receipts", async () => {
    const saved = await record({ received_from: "Penderma A" });
    for (const role of ["pengerusi", "bendahari", "setiausaha"] as Role[]) {
      const { data } = await (await userClient("b", role)).from("transactions").select("id, receipt_no").eq("id", saved.id);
      expect(data ?? []).toEqual([]);
    }
  });

  it("the Imam of masjid A cannot read receipts either", async () => {
    const saved = await record();
    const { data } = await (await userClient("a", "imam")).from("transactions").select("id").eq("id", saved.id);
    expect(data ?? []).toEqual([]);
  });
});
