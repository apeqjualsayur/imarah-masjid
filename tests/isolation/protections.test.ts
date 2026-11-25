import { describe, expect, it } from "vitest";
import { firstRowId, LOCKED_MONTH, masjidId, OPEN_DATE } from "../../scripts/seed-data";
import { admin, firstAuditRowId, PERMISSION_DENIED, userClient, userId } from "./helpers";

const MASJID_A = masjidId("a");
const LOCKED_DATE = "2026-09-15";

const newTransaction = (overrides = {}) => ({
  fund_id: firstRowId("a", "funds"),
  amount_sen: 12_345,
  direction: "in",
  date: OPEN_DATE,
  method: "cash",
  ...overrides,
});

async function addTransaction(overrides = {}) {
  const client = await userClient("a", "bendahari");
  const { data, error } = await client.from("transactions").insert(newTransaction(overrides)).select().single();
  expect(error).toBeNull();
  return data;
}

// Each run needs its own month, because period records can never be deleted.
async function unusedMonth() {
  const { data } = await admin.from("periods").select("month").eq("masjid_id", MASJID_A);
  const used = new Set(data?.map((row) => row.month));
  for (let year = 2030; year < 2100; year += 1) {
    for (const month of ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12"]) {
      const candidate = `${year}-${month}-01`;
      if (!used.has(candidate)) return candidate;
    }
  }
  throw new Error("no unused month left");
}

describe("transactions are append-only", () => {
  it("Bendahari cannot edit one", async () => {
    const row = await addTransaction();
    const client = await userClient("a", "bendahari");
    const { error } = await client.from("transactions").update({ amount_sen: 1 }).eq("id", row.id).select();
    expect(error?.code).toBe(PERMISSION_DENIED);
  });

  it("Bendahari cannot delete one", async () => {
    const row = await addTransaction();
    const client = await userClient("a", "bendahari");
    const { error } = await client.from("transactions").delete().eq("id", row.id).select();
    expect(error?.code).toBe(PERMISSION_DENIED);
  });

  it("even the secret key cannot edit one", async () => {
    const row = await addTransaction();
    const { error } = await admin.from("transactions").update({ amount_sen: 1 }).eq("id", row.id);
    expect(error?.message).toContain("append-only");
    const { data } = await admin.from("transactions").select("amount_sen").eq("id", row.id).single();
    expect(data?.amount_sen).toBe(row.amount_sen);
  });

  it("even the secret key cannot delete one", async () => {
    const row = await addTransaction();
    const { error } = await admin.from("transactions").delete().eq("id", row.id);
    expect(error?.message).toContain("append-only");
    const { data } = await admin.from("transactions").select("id").eq("id", row.id);
    expect(data).toHaveLength(1);
  });

  it("the status cannot be changed either", async () => {
    const row = await addTransaction();
    const { error } = await admin.from("transactions").update({ status: "void" }).eq("id", row.id);
    expect(error).not.toBeNull();
  });
});

describe("reversals", () => {
  const reversalOf = (row: { id: string; amount_sen: number; fund_id: string }, overrides = {}) =>
    newTransaction({
      reverses_id: row.id,
      amount_sen: row.amount_sen,
      fund_id: row.fund_id,
      direction: "out",
      ...overrides,
    });

  it("Pengerusi can reverse a transaction", async () => {
    const row = await addTransaction();
    const client = await userClient("a", "pengerusi");
    const { error } = await client.from("transactions").insert(reversalOf(row));
    expect(error).toBeNull();
  });

  it("Pengerusi cannot add an ordinary transaction", async () => {
    const client = await userClient("a", "pengerusi");
    const { error } = await client.from("transactions").insert(newTransaction());
    expect(error?.code).toBe(PERMISSION_DENIED);
  });

  it("a transaction can only be reversed once", async () => {
    const row = await addTransaction();
    const client = await userClient("a", "bendahari");
    await client.from("transactions").insert(reversalOf(row));
    const { error } = await client.from("transactions").insert(reversalOf(row));
    expect(error).not.toBeNull();
  });

  it("must match the amount", async () => {
    const row = await addTransaction();
    const client = await userClient("a", "bendahari");
    const { error } = await client.from("transactions").insert(reversalOf(row, { amount_sen: 1 }));
    expect(error?.message).toContain("reversal");
  });

  it("must go the opposite way", async () => {
    const row = await addTransaction();
    const client = await userClient("a", "bendahari");
    const { error } = await client.from("transactions").insert(reversalOf(row, { direction: "in" }));
    expect(error?.message).toContain("reversal");
  });

  it("cannot reverse a reversal", async () => {
    const row = await addTransaction();
    const client = await userClient("a", "bendahari");
    const { data } = await client.from("transactions").insert(reversalOf(row)).select().single();
    const { error } = await client
      .from("transactions")
      .insert(reversalOf(data, { direction: "in" }));
    expect(error?.message).toContain("reversal");
  });
});

describe("locked months", () => {
  it("the seed locked September 2026", async () => {
    const { data } = await admin
      .from("periods")
      .select("locked_at")
      .eq("masjid_id", MASJID_A)
      .eq("month", LOCKED_MONTH)
      .single();
    expect(data?.locked_at).not.toBeNull();
  });

  it("Bendahari cannot add a transaction into one", async () => {
    const client = await userClient("a", "bendahari");
    const { error } = await client.from("transactions").insert(newTransaction({ date: LOCKED_DATE }));
    expect(error?.message).toContain("locked period");
  });

  it("the secret key cannot either", async () => {
    const { error } = await admin
      .from("transactions")
      .insert(newTransaction({ date: LOCKED_DATE, masjid_id: MASJID_A }));
    expect(error?.message).toContain("locked period");
  });

  it("cannot add a collection into one", async () => {
    const client = await userClient("a", "bendahari");
    const { error } = await client.from("collections").insert({
      fund_id: firstRowId("a", "funds"),
      date: LOCKED_DATE,
      total_sen: 100,
      counted_by: await userId("a", "bendahari"),
    });
    expect(error?.message).toContain("locked period");
  });

  it("cannot change a bank line dated in one", async () => {
    const client = await userClient("a", "bendahari");
    const { data: lines } = await admin
      .from("bank_lines")
      .select("id")
      .eq("masjid_id", MASJID_A)
      .eq("date", "2026-09-16");
    const { error } = await client.from("bank_lines").update({ description: "ubah" }).eq("id", lines?.[0].id);
    expect(error?.message).toContain("locked period");
  });

  it("cannot move a bank line out of one", async () => {
    const client = await userClient("a", "bendahari");
    const { data: lines } = await admin
      .from("bank_lines")
      .select("id")
      .eq("masjid_id", MASJID_A)
      .eq("date", "2026-09-16");
    const { error } = await client.from("bank_lines").update({ date: OPEN_DATE }).eq("id", lines?.[0].id);
    expect(error?.message).toContain("locked period");
  });

  it("cannot delete a bank line dated in one", async () => {
    const client = await userClient("a", "bendahari");
    const { data: lines } = await admin
      .from("bank_lines")
      .select("id")
      .eq("masjid_id", MASJID_A)
      .eq("date", "2026-09-16");
    const { error } = await client.from("bank_lines").delete().eq("id", lines?.[0].id);
    expect(error?.message).toContain("locked period");
  });

  it("locks, reverses into an open month, and unlocks only with a reason", async () => {
    const month = await unusedMonth();
    const date = month.replace(/01$/, "15");
    const original = await addTransaction({ date });
    const pengerusi = await userClient("a", "pengerusi");
    const bendahari = await userClient("a", "bendahari");

    const { data: period, error: lockError } = await pengerusi
      .from("periods")
      .insert({ month, locked_at: new Date().toISOString() })
      .select()
      .single();
    expect(lockError).toBeNull();
    expect(period.locked_by).toBe(await userId("a", "pengerusi"));

    const { error: blocked } = await bendahari.from("transactions").insert(newTransaction({ date }));
    expect(blocked?.message).toContain("locked period");

    const { error: reversalError } = await bendahari.from("transactions").insert(
      newTransaction({
        reverses_id: original.id,
        amount_sen: original.amount_sen,
        direction: "out",
      }),
    );
    expect(reversalError).toBeNull();

    const { error: noReason } = await pengerusi
      .from("periods")
      .update({ locked_at: null })
      .eq("id", period.id)
      .select();
    expect(noReason?.message).toContain("needs a reason");

    const { error: unlockError } = await pengerusi
      .from("periods")
      .update({ locked_at: null, unlock_reason: "Betulkan kesilapan" })
      .eq("id", period.id)
      .select();
    expect(unlockError).toBeNull();

    const { error: open } = await bendahari.from("transactions").insert(newTransaction({ date }));
    expect(open).toBeNull();
  });

  it("only Pengerusi can lock a month", async () => {
    const client = await userClient("a", "bendahari");
    const { error } = await client
      .from("periods")
      .insert({ month: await unusedMonth(), locked_at: new Date().toISOString() });
    expect(error?.code).toBe(PERMISSION_DENIED);
  });

  it("a month record cannot be deleted, even with the secret key", async () => {
    const { error } = await admin.from("periods").delete().eq("id", firstRowId("a", "periods"));
    expect(error?.message).toContain("cannot be deleted");
  });
});

describe("audit log", () => {
  it("records who changed what, in the same masjid", async () => {
    const row = await addTransaction();
    const { data } = await admin
      .from("audit_log")
      .select("*")
      .eq("table_name", "transactions")
      .eq("row_id", row.id)
      .single();
    expect(data.action).toBe("INSERT");
    expect(data.masjid_id).toBe(MASJID_A);
    expect(data.user_id).toBe(await userId("a", "bendahari"));
    expect(data.after.amount_sen).toBe(row.amount_sen);
  });

  it("hides personal data but shows that a field changed", async () => {
    const client = await userClient("a", "setiausaha");
    const name = `Rahsia ${crypto.randomUUID()}`;
    const { data: household } = await client
      .from("households")
      .insert({ head_name: name, phone: "0123456789" })
      .select()
      .single();
    await client.from("households").update({ phone: "0199999999" }).eq("id", household.id);
    await client.from("households").delete().eq("id", household.id);

    const { data } = await admin
      .from("audit_log")
      .select("action, before, after")
      .eq("table_name", "households")
      .eq("row_id", household.id)
      .order("at");

    expect(data?.map((row) => row.action)).toEqual(["INSERT", "UPDATE", "DELETE"]);
    const update = data?.[1];
    expect(update?.after.phone).toBe("[changed]");
    expect(update?.before.phone).toBe("[changed]");
    expect(update?.after.head_name).toBe("[hidden]");

    const stored = JSON.stringify(data);
    expect(stored).not.toContain(name);
    expect(stored).not.toContain("0123456789");
    expect(stored).not.toContain("0199999999");
  });

  it.each(["pengerusi", "bendahari"] as const)("%s cannot edit it", async (role) => {
    const id = await firstAuditRowId(MASJID_A);
    const client = await userClient("a", role);
    const { error } = await client.from("audit_log").update({ table_name: "ubah" }).eq("id", id).select();
    expect(error?.code).toBe(PERMISSION_DENIED);
  });

  it.each(["pengerusi", "bendahari"] as const)("%s cannot delete from it", async (role) => {
    const id = await firstAuditRowId(MASJID_A);
    const client = await userClient("a", role);
    const { error } = await client.from("audit_log").delete().eq("id", id).select();
    expect(error?.code).toBe(PERMISSION_DENIED);
  });

  it("nobody can forge an entry", async () => {
    const client = await userClient("a", "pengerusi");
    const row = {
      masjid_id: MASJID_A,
      table_name: "palsu",
      row_id: crypto.randomUUID(),
      action: "INSERT",
    };
    const { error } = await client.from("audit_log").insert(row);
    expect(error?.code).toBe(PERMISSION_DENIED);
    const { error: adminError } = await admin.from("audit_log").insert(row);
    expect(adminError?.code).toBe(PERMISSION_DENIED);
  });

  it("the secret key can only read it", async () => {
    const id = await firstAuditRowId(MASJID_A);
    const { error: updateError } = await admin.from("audit_log").update({ table_name: "ubah" }).eq("id", id);
    expect(updateError?.code).toBe(PERMISSION_DENIED);
    const { error: deleteError } = await admin.from("audit_log").delete().eq("id", id);
    expect(deleteError?.code).toBe(PERMISSION_DENIED);
  });
});

describe("memberships", () => {
  it("one user cannot join a second masjid", async () => {
    const { error } = await admin.from("memberships").insert({
      user_id: await userId("a", "bendahari"),
      masjid_id: masjidId("b"),
      role: "ajk",
    });
    expect(error?.code).toBe("23505");
  });

  it("the last Pengerusi cannot be demoted", async () => {
    const client = await userClient("a", "pengerusi");
    const { error } = await client
      .from("memberships")
      .update({ role: "ajk" })
      .eq("id", firstRowId("a", "memberships"))
      .select();
    expect(error?.message).toContain("last Pengerusi");
  });

  it("the last Pengerusi cannot be removed, even with the secret key", async () => {
    const { error } = await admin
      .from("memberships")
      .update({ status: "removed" })
      .eq("id", firstRowId("a", "memberships"));
    expect(error?.message).toContain("last Pengerusi");
  });

  it("Pengerusi cannot change the masjid's plan", async () => {
    const client = await userClient("a", "pengerusi");
    const { error } = await client.from("masjids").update({ plan: "pro" }).eq("id", MASJID_A).select();
    expect(error?.code).toBe(PERMISSION_DENIED);
  });

});

describe("collections", () => {
  async function addCollection() {
    const client = await userClient("a", "bendahari");
    const { data, error } = await client
      .from("collections")
      .insert({
        fund_id: firstRowId("a", "funds"),
        date: OPEN_DATE,
        total_sen: 100_000,
        counted_by: await userId("a", "bendahari"),
      })
      .select()
      .single();
    expect(error).toBeNull();
    return data;
  }

  it("nobody can confirm their own count", async () => {
    const row = await addCollection();
    const client = await userClient("a", "bendahari");
    const { error } = await client
      .from("collections")
      .update({ confirmed_by: await userId("a", "bendahari") })
      .eq("id", row.id)
      .select();
    expect(error).not.toBeNull();
  });

  it("a different person can confirm it, once", async () => {
    const row = await addCollection();
    const pengerusi = await userClient("a", "pengerusi");
    const { error } = await pengerusi
      .from("collections")
      .update({ confirmed_by: await userId("a", "pengerusi") })
      .eq("id", row.id)
      .select();
    expect(error).toBeNull();

    const ajk = await userClient("a", "ajk");
    const { error: second } = await ajk
      .from("collections")
      .update({ confirmed_by: await userId("a", "ajk") })
      .eq("id", row.id)
      .select();
    expect(second?.message).toContain("cannot be changed");
  });

  it("cannot confirm in someone else's name", async () => {
    const row = await addCollection();
    const client = await userClient("a", "ajk");
    const { error } = await client
      .from("collections")
      .update({ confirmed_by: await userId("a", "pengerusi") })
      .eq("id", row.id)
      .select();
    expect(error?.code).toBe(PERMISSION_DENIED);
  });

  it("the counted total cannot be changed", async () => {
    const row = await addCollection();
    const client = await userClient("a", "bendahari");
    const { error } = await client.from("collections").update({ total_sen: 1 }).eq("id", row.id).select();
    expect(error?.code).toBe(PERMISSION_DENIED);
  });
});

describe("masjid_id comes from the session", () => {
  it("a new row without masjid_id lands in the caller's masjid", async () => {
    const row = await addTransaction();
    expect(row.masjid_id).toBe(MASJID_A);
  });
});
