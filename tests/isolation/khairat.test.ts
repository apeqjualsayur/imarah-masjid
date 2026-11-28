import { describe, expect, it } from "vitest";
import { firstRowId, masjidId, OPEN_DATE, type Role } from "../../scripts/seed-data";
import { admin, newUser, PERMISSION_DENIED, userClient } from "./helpers";

const MASJID_A = masjidId("a");
const PLAN_2026 = () => firstRowId("a", "khairat_plans");
const CHECK_VIOLATION = "23514";
const UNIQUE_VIOLATION = "23505";

/** A fresh household in masjid A, so tests never depend on each other. */
async function household(members = 0) {
  const { data, error } = await admin
    .from("households")
    .insert({ masjid_id: MASJID_A, head_name: `Ketua Khairat ${crypto.randomUUID().slice(0, 8)}` })
    .select("id, head_name")
    .single();
  expect(error).toBeNull();
  for (let n = 0; n < members; n++) {
    await admin.from("members").insert({ masjid_id: MASJID_A, household_id: data!.id, name: `Ahli ${n}` });
  }
  return data!;
}

async function enrol(householdId: string, year = 2026, role: Role = "setiausaha") {
  const client = await userClient("a", role);
  const result = await client.rpc("enrol_khairat", { p_year: year, p_household_ids: [householdId] });
  if (result.error) return { error: result.error, id: null };
  const { data } = await admin
    .from("khairat_members")
    .select("id, khairat_plans!inner(year)")
    .eq("household_id", householdId)
    .eq("khairat_plans.year", year)
    .single();
  return { error: null, id: (data as { id: string } | null)?.id ?? null, added: result.data };
}

async function pay(memberId: string, amount: number, role: Role = "bendahari", extra: Record<string, unknown> = {}) {
  return (await userClient("a", role)).rpc("record_khairat_payment", {
    p_member_id: memberId,
    p_amount_sen: amount,
    p_date: OPEN_DATE,
    p_method: "cash",
    ...extra,
  });
}

async function paid(memberId: string) {
  const { data } = await admin.from("khairat_members").select("paid_sen").eq("id", memberId).single();
  return Number(data!.paid_sen);
}

describe("yearly setup", () => {
  it.each(["pengerusi", "bendahari"] as Role[])("%s can change it", async (role) => {
    const { data, error } = await (await userClient("a", role)).from("khairat_plans").update({ fee_sen: 5_000 }).eq("id", PLAN_2026()).select("id");
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
  });

  it.each(["setiausaha", "ajk", "imam"] as Role[])("%s cannot change it", async (role) => {
    const { data } = await (await userClient("a", role)).from("khairat_plans").update({ fee_sen: 1 }).eq("id", PLAN_2026()).select("id");
    expect(data ?? []).toEqual([]);
  });

  it.each(["setiausaha", "ajk", "imam"] as Role[])("%s cannot add a year", async (role) => {
    const { error } = await (await userClient("a", role))
      .from("khairat_plans")
      .insert({ year: 2090, fee_sen: 1, pay_by: "2090-03-31", fund_id: firstRowId("a", "funds") });
    expect(error?.code).toBe(PERMISSION_DENIED);
  });

  it("one setup per year", async () => {
    const { error } = await (await userClient("a", "bendahari"))
      .from("khairat_plans")
      .insert({ year: 2026, fee_sen: 1, pay_by: "2026-03-31", fund_id: firstRowId("a", "funds") });
    expect(error?.code).toBe(UNIQUE_VIOLATION);
  });

  it("the last day to pay must be in the same year, and the year cannot change", async () => {
    const client = await userClient("a", "bendahari");
    const wrongDate = await client.from("khairat_plans").update({ pay_by: "2027-01-01" }).eq("id", PLAN_2026());
    expect(wrongDate.error?.code).toBe(CHECK_VIOLATION);
    const wrongYear = await client.from("khairat_plans").update({ year: 2027 }).eq("id", PLAN_2026());
    expect(wrongYear.error?.message).toContain("cannot change");
  });
});

describe("enrolling", () => {
  it.each(["bendahari", "setiausaha"] as Role[])("%s can enrol a household, once", async (role) => {
    const h = await household();
    const first = await enrol(h.id, 2026, role);
    expect(first.error).toBeNull();
    expect(first.added).toBe(1);
    const again = await enrol(h.id, 2026, role);
    expect(again.added).toBe(0);
  });

  it.each(["pengerusi", "ajk", "imam"] as Role[])("%s cannot", async (role) => {
    const h = await household();
    const { error } = await enrol(h.id, 2026, role);
    expect(error?.code).toBe(PERMISSION_DENIED);
  });

  it("a year with no setup is refused", async () => {
    const h = await household();
    const { error } = await enrol(h.id, 2099);
    expect(error?.message).toContain("no setup for this year");
  });

  it.each(["pengerusi", "bendahari", "setiausaha", "ajk", "imam"] as Role[])("%s cannot write members directly", async (role) => {
    const client = await userClient("a", role);
    const h = await household();
    const insert = await client.from("khairat_members").insert({ household_id: h.id, plan_id: PLAN_2026() });
    expect(insert.error?.code).toBe(PERMISSION_DENIED);
    const update = await client.from("khairat_members").update({ paid_sen: 99_999 }).eq("id", firstRowId("a", "khairat_members")).select();
    expect(update.error?.code).toBe(PERMISSION_DENIED);
  });

  it("per person: the people listed under the household are counted", async () => {
    await admin
      .from("khairat_plans")
      .upsert(
        { masjid_id: MASJID_A, year: 2031, fee_sen: 1_000, coverage: "person", pay_by: "2031-03-31", fund_id: firstRowId("a", "funds") },
        { onConflict: "masjid_id,year", ignoreDuplicates: true },
      );
    const three = await household(3);
    const none = await household(0);
    const a = await enrol(three.id, 2031);
    const b = await enrol(none.id, 2031);
    const { data } = await admin.from("khairat_members").select("id, people").in("id", [a.id, b.id]);
    expect(Object.fromEntries((data ?? []).map((row) => [row.id, row.people]))).toEqual({ [a.id!]: 3, [b.id!]: 1 });

    // RM 10 x 3 people: RM 30 can be paid, not a sen more.
    expect((await pay(a.id!, 3_001)).error?.message).toContain("more than what is owed");
    expect((await pay(a.id!, 3_000)).error).toBeNull();
  });

  it("re-enrolling last year's members skips those who ended", async () => {
    const stays = await household();
    const leaves = await household();
    const s = await enrol(stays.id, 2025);
    const l = await enrol(leaves.id, 2025);
    await (await userClient("a", "setiausaha")).rpc("end_khairat", { p_member_id: l.id, p_reason: "Berpindah" });

    const { error } = await (await userClient("a", "bendahari")).rpc("renew_khairat", { p_year: 2026 });
    expect(error).toBeNull();
    const { data } = await admin
      .from("khairat_members")
      .select("household_id, khairat_plans!inner(year)")
      .in("household_id", [stays.id, leaves.id])
      .eq("khairat_plans.year", 2026);
    expect(s.id).not.toBeNull();
    expect((data ?? []).map((row) => row.household_id)).toEqual([stays.id]);
  });
});

describe("recording a payment", () => {
  it("posts a numbered receipt into the khairat fund, linked to the household, and updates what is paid", async () => {
    const h = await household();
    const { id } = await enrol(h.id);
    const { data: txId, error } = await pay(id!, 2_000, "setiausaha");
    expect(error).toBeNull();

    const { data: tx } = await admin.from("transactions").select("*").eq("id", txId).single();
    const { data: plan } = await admin.from("khairat_plans").select("fund_id").eq("id", PLAN_2026()).single();
    const { data: category } = await admin.from("categories").select("name").eq("id", tx!.category_id).single();
    expect(tx).toMatchObject({
      direction: "in",
      amount_sen: 2_000,
      fund_id: plan!.fund_id,
      household_id: h.id,
      khairat_member_id: id,
      received_from: h.head_name,
      note: "Yuran khairat 2026",
    });
    expect(category!.name).toBe("Khairat");
    expect(tx!.receipt_no).toMatch(/^RC-2026-\d{4,}$/);
    expect(await paid(id!)).toBe(2_000);
  });

  it("partial payments add up, and the last sen is the limit", async () => {
    const h = await household();
    const { id } = await enrol(h.id);
    expect((await pay(id!, 1_500)).error).toBeNull();
    expect((await pay(id!, 2_500)).error).toBeNull();
    expect(await paid(id!)).toBe(4_000);
    expect((await pay(id!, 1_001)).error?.message).toContain("more than what is owed");
    expect((await pay(id!, 1_000)).error).toBeNull();
    expect(await paid(id!)).toBe(5_000);
    expect((await pay(id!, 1)).error?.message).toContain("more than what is owed");
  });

  it("two payments at the same moment cannot pay more than is owed", async () => {
    const h = await household();
    const { id } = await enrol(h.id);
    const results = await Promise.all([pay(id!, 3_000), pay(id!, 3_000, "setiausaha")]);
    expect(results.filter((result) => result.error === null)).toHaveLength(1);
    expect(await paid(id!)).toBe(3_000);
  });

  it("a payment for one year does not count for another year", async () => {
    const h = await household();
    const last = await enrol(h.id, 2025);
    const now = await enrol(h.id, 2026);
    expect((await pay(last.id!, 5_000)).error).toBeNull();
    expect(await paid(last.id!)).toBe(5_000);
    expect(await paid(now.id!)).toBe(0);
    // Paying ahead into a year already settled is refused.
    expect((await pay(last.id!, 5_000)).error?.message).toContain("more than what is owed for 2025");
  });

  it("cancelling a payment in the ledger takes it off what is paid", async () => {
    const h = await household();
    const { id } = await enrol(h.id);
    const { data: txId } = await pay(id!, 5_000);
    const { data: original } = await admin.from("transactions").select("*").eq("id", txId).single();
    const { error } = await (await userClient("a", "pengerusi")).from("transactions").insert({
      reverses_id: original!.id,
      fund_id: original!.fund_id,
      category_id: original!.category_id,
      amount_sen: original!.amount_sen,
      direction: "out",
      method: original!.method,
      date: OPEN_DATE,
      reversal_reason: "Salah rekod",
    });
    expect(error).toBeNull();
    expect(await paid(id!)).toBe(0);
  });

  it("an app user cannot link an entry to a membership themselves", async () => {
    const { error } = await (await userClient("a", "bendahari")).from("transactions").insert({
      fund_id: firstRowId("a", "funds"),
      amount_sen: 5_000,
      direction: "in",
      date: OPEN_DATE,
      method: "cash",
      khairat_member_id: firstRowId("a", "khairat_members"),
    });
    expect(error?.code).toBe(PERMISSION_DENIED);
  });

  it.each(["pengerusi", "ajk", "imam"] as Role[])("%s cannot record a payment", async (role) => {
    const h = await household();
    const { id } = await enrol(h.id);
    expect((await pay(id!, 100, role)).error?.code).toBe(PERMISSION_DENIED);
  });

  it("zero, negative and a payment into a locked month are refused", async () => {
    const h = await household();
    const { id } = await enrol(h.id);
    expect((await pay(id!, 0)).error).not.toBeNull();
    expect((await pay(id!, -100)).error).not.toBeNull();
    expect((await pay(id!, 100, "bendahari", { p_date: "2026-09-15" })).error?.message).toContain("locked");
    expect(await paid(id!)).toBe(0);
  });
});

describe("ending a membership", () => {
  it("needs a reason, stops payments, and cannot be ended twice", async () => {
    const h = await household();
    const { id } = await enrol(h.id);
    const client = await userClient("a", "setiausaha");
    expect((await client.rpc("end_khairat", { p_member_id: id, p_reason: "  " })).error?.message).toContain("reason is required");
    expect((await client.rpc("end_khairat", { p_member_id: id, p_reason: "Meninggal dunia" })).error).toBeNull();
    expect((await pay(id!, 100)).error?.message).toContain("membership has ended");
    expect((await client.rpc("end_khairat", { p_member_id: id, p_reason: "Lagi" })).error).not.toBeNull();

    const { data } = await admin.from("khairat_members").select("end_reason, ended_by").eq("id", id).single();
    expect(data?.end_reason).toBe("Meninggal dunia");
    expect(data?.ended_by).not.toBeNull();
  });

  it.each(["pengerusi", "ajk", "imam"] as Role[])("%s cannot end one", async (role) => {
    const h = await household();
    const { id } = await enrol(h.id);
    const { error } = await (await userClient("a", role)).rpc("end_khairat", { p_member_id: id, p_reason: "Ujian" });
    expect(error?.code).toBe(PERMISSION_DENIED);
  });
});

describe("between masjids", () => {
  it("masjid B cannot pay, end or enrol masjid A's members", async () => {
    const h = await household();
    const { id } = await enrol(h.id);
    const b = await userClient("b", "bendahari");
    expect((await b.rpc("record_khairat_payment", { p_member_id: id, p_amount_sen: 100, p_date: OPEN_DATE, p_method: "cash" })).error?.message).toContain(
      "member not found",
    );
    expect((await b.rpc("end_khairat", { p_member_id: id, p_reason: "Ujian" })).error?.message).toContain("not found");
    const { data: added } = await b.rpc("enrol_khairat", { p_year: 2026, p_household_ids: [h.id] });
    expect(added).toBe(0);
    expect(await paid(id!)).toBe(0);
  });
});

describe("Asas plan", () => {
  it("cannot set up khairat, enrol or pay, even with the right role", async () => {
    const owner = await newUser();
    const { data: newMasjid, error } = await owner.client.rpc("create_masjid", {
      p_name: "Surau Asas Ujian",
      p_state: "Selangor",
      p_address: "1 Jalan Ujian",
      p_prayer_zone: "SGR01",
    });
    expect(error).toBeNull();

    const { data: fund } = await admin.from("funds").select("id").eq("masjid_id", newMasjid).limit(1).single();
    const setup = await owner.client.from("khairat_plans").insert({ year: 2026, fee_sen: 5_000, pay_by: "2026-03-31", fund_id: fund!.id });
    expect(setup.error?.code).toBe(PERMISSION_DENIED);

    // A Setiausaha of that masjid is still refused by the plan.
    const secretary = await newUser();
    await admin.from("memberships").insert({ masjid_id: newMasjid, user_id: secretary.id, role: "setiausaha" });
    const { error: enrolError } = await secretary.client.rpc("enrol_khairat", { p_year: 2026, p_household_ids: [] });
    expect(enrolError?.message).toContain("not on this plan");
  });
});
