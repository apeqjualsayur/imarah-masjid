import { describe, expect, it } from "vitest";
import { firstRowId, OPEN_DATE, type Role } from "../../scripts/seed-data";
import { admin, anon, PERMISSION_DENIED, userClient, userId } from "./helpers";

const FUND = () => firstRowId("a", "funds");

/** A count in masjid A, saved through the app's own route. Returns its id. */
async function count(role: Role = "bendahari", total = 142_050, extra: Record<string, unknown> = {}) {
  const client = await userClient("a", role);
  const { data, error } = await client.rpc("record_collection", {
    p_key: crypto.randomUUID(),
    p_date: OPEN_DATE,
    p_fund_id: FUND(),
    p_total_sen: total,
    ...extra,
  });
  expect(error).toBeNull();
  return data as string;
}

async function confirm(role: Role, id: string, total = 142_050) {
  return (await userClient("a", role)).rpc("confirm_collection", { p_id: id, p_total_sen: total });
}

async function row(id: string) {
  const { data } = await admin.from("collections").select("*").eq("id", id).single();
  return data;
}

async function postings(id: string) {
  const { data } = await admin.from("collections").select("transaction_id").eq("id", id).single();
  if (!data?.transaction_id) return [];
  const { data: rows } = await admin.from("transactions").select("*").eq("id", data.transaction_id);
  return rows ?? [];
}

describe("who can count", () => {
  it.each(["bendahari", "ajk"] as Role[])("%s can", async (role) => {
    const id = await count(role);
    expect((await row(id)).counted_by).toBe(await userId("a", role));
  });

  it.each(["pengerusi", "setiausaha", "imam"] as Role[])("%s cannot", async (role) => {
    const { error } = await (await userClient("a", role)).rpc("record_collection", {
      p_key: crypto.randomUUID(),
      p_date: OPEN_DATE,
      p_fund_id: FUND(),
      p_total_sen: 100,
    });
    expect(error?.code).toBe(PERMISSION_DENIED);
  });

  it.each(["pengerusi", "bendahari", "setiausaha", "ajk", "imam"] as Role[])(
    "%s cannot write the table directly",
    async (role) => {
      const client = await userClient("a", role);
      const insert = await client.from("collections").insert({
        fund_id: FUND(),
        date: OPEN_DATE,
        total_sen: 100,
        counted_by: await userId("a", role),
      });
      expect(insert.error?.code).toBe(PERMISSION_DENIED);
      const id = await count();
      const update = await client.from("collections").update({ status: "confirmed" }).eq("id", id).select();
      expect(update.error?.code).toBe(PERMISSION_DENIED);
      const remove = await client.from("collections").delete().eq("id", id).select();
      expect(remove.error?.code).toBe(PERMISSION_DENIED);
    },
  );
});

describe("sending the same count twice", () => {
  it("saves it once", async () => {
    const client = await userClient("a", "ajk");
    const input = { p_key: crypto.randomUUID(), p_date: OPEN_DATE, p_fund_id: FUND(), p_total_sen: 5_000 };
    const first = await client.rpc("record_collection", input);
    const second = await client.rpc("record_collection", input);
    expect(second.data).toBe(first.data);
    const { data } = await admin.from("collections").select("id").eq("client_key", input.p_key);
    expect(data).toHaveLength(1);
  });

  it("saves it once even when sent five times at the same moment", async () => {
    const client = await userClient("a", "ajk");
    const input = { p_key: crypto.randomUUID(), p_date: OPEN_DATE, p_fund_id: FUND(), p_total_sen: 5_000 };
    const results = await Promise.all([1, 2, 3, 4, 5].map(() => client.rpc("record_collection", input)));
    expect(results.every((result) => result.error === null)).toBe(true);
    expect(new Set(results.map((result) => result.data)).size).toBe(1);
    const { data } = await admin.from("collections").select("id").eq("client_key", input.p_key);
    expect(data).toHaveLength(1);
  });
});

describe("checks on a count", () => {
  it("refuses a date after today", async () => {
    const { error } = await (await userClient("a", "ajk")).rpc("record_collection", {
      p_key: crypto.randomUUID(),
      p_date: "2099-01-01",
      p_fund_id: FUND(),
      p_total_sen: 100,
    });
    expect(error?.message).toContain("in the future");
  });

  it("refuses zero", async () => {
    const { error } = await (await userClient("a", "ajk")).rpc("record_collection", {
      p_key: crypto.randomUUID(),
      p_date: OPEN_DATE,
      p_fund_id: FUND(),
      p_total_sen: 0,
    });
    expect(error?.message).toContain("more than zero");
  });

  it("a breakdown must add up to the amount", async () => {
    const client = await userClient("a", "ajk");
    const base = { p_date: OPEN_DATE, p_fund_id: FUND() };
    const wrong = await client.rpc("record_collection", {
      ...base,
      p_key: crypto.randomUUID(),
      p_total_sen: 10_000,
      p_breakdown: { "50": 1, "10": 4 },
    });
    expect(wrong.error?.message).toContain("does not add up");
    const right = await client.rpc("record_collection", {
      ...base,
      p_key: crypto.randomUUID(),
      p_total_sen: 9_250,
      p_breakdown: { "50": 1, "10": 4, coins_sen: 250 },
    });
    expect(right.error).toBeNull();
    const odd = await client.rpc("record_collection", {
      ...base,
      p_key: crypto.randomUUID(),
      p_total_sen: 300,
      p_breakdown: { "3": 1 },
    });
    expect(odd.error?.message).toContain("unknown note");
  });
});

describe("two-person confirmation", () => {
  it("the counter cannot confirm their own count", async () => {
    const id = await count("bendahari");
    const { error } = await confirm("bendahari", id);
    expect(error?.message).toContain("your own count");
    expect((await row(id)).status).toBe("counted");
    expect(await postings(id)).toEqual([]);
  });

  it("not even the secret key can record the counter as the confirmer", async () => {
    const id = await count("ajk");
    const { error } = await admin
      .from("collections")
      .update({ confirmed_by: await userId("a", "ajk") })
      .eq("id", id);
    expect(error).not.toBeNull();
    expect((await row(id)).confirmed_by).toBeNull();
  });

  it.each([
    ["pengerusi", "bendahari"],
    ["bendahari", "ajk"],
    ["ajk", "bendahari"],
  ] as [Role, Role][])("%s can confirm a count by %s", async (confirmer, counter) => {
    const id = await count(counter);
    const { data, error } = await confirm(confirmer, id);
    expect(error).toBeNull();
    expect(data).toBe("confirmed");
  });

  it.each(["setiausaha", "imam"] as Role[])("%s cannot confirm", async (role) => {
    const id = await count("ajk");
    const { error } = await confirm(role, id);
    expect(error?.code).toBe(PERMISSION_DENIED);
  });

  it("a matching count posts one receipt to the ledger with a receipt number", async () => {
    const id = await count("ajk", 142_050);
    await confirm("pengerusi", id);
    const collection = await row(id);
    expect(collection.status).toBe("confirmed");
    expect(collection.confirmed_by).toBe(await userId("a", "pengerusi"));

    const posted = await postings(id);
    expect(posted).toHaveLength(1);
    expect(posted[0]).toMatchObject({ amount_sen: 142_050, direction: "in", date: OPEN_DATE, fund_id: FUND(), method: "cash" });
    expect(posted[0].receipt_no).toMatch(/^RC-2026-\d{4,}$/);
    const { data: category } = await admin.from("categories").select("name").eq("id", posted[0].category_id).single();
    expect(category?.name).toBe("Kutipan Jumaat");
  });

  it("confirming again does not post twice", async () => {
    const id = await count("ajk");
    await confirm("pengerusi", id);
    const again = await confirm("bendahari", id);
    expect(again.data).toBe("confirmed");
    const { data } = await admin.from("transactions").select("id").eq("id", (await row(id)).transaction_id);
    expect(data).toHaveLength(1);
    expect((await row(id)).confirmed_by).toBe(await userId("a", "pengerusi"));
  });

  it("two people confirming at the same moment post once", async () => {
    // An amount no other test uses, so every posting of this count can be found.
    const amount = 200_000 + Math.floor(Math.random() * 800_000);
    const id = await count("ajk", amount);
    const results = await Promise.all([confirm("pengerusi", id, amount), confirm("bendahari", id, amount)]);
    expect(results.every((result) => result.data === "confirmed")).toBe(true);
    const { count: posted } = await admin
      .from("transactions")
      .select("id", { count: "exact", head: true })
      .eq("masjid_id", (await row(id)).masjid_id)
      .eq("amount_sen", amount)
      .eq("date", OPEN_DATE);
    expect(posted).toBe(1);
  });
});

describe("a different amount", () => {
  it("is marked for checking and nothing is posted, until recounted and confirmed by someone else", async () => {
    const id = await count("bendahari", 100_000);
    const { data } = await confirm("ajk", id, 99_000);
    expect(data).toBe("needs_review");
    let collection = await row(id);
    expect(collection.status).toBe("needs_review");
    expect(collection.check_total_sen).toBe(99_000);
    expect(await postings(id)).toEqual([]);

    // It cannot simply be confirmed now.
    expect((await confirm("pengerusi", id, 100_000)).error?.message).toContain("recount first");

    // The AJK recounts with the agreed figure and becomes the counter.
    const ajk = await userClient("a", "ajk");
    expect((await ajk.rpc("recount_collection", { p_id: id, p_total_sen: 99_500 })).error).toBeNull();
    collection = await row(id);
    expect(collection.status).toBe("counted");
    expect(collection.counted_by).toBe(await userId("a", "ajk"));

    // So the AJK cannot confirm it; the Bendahari can.
    expect((await confirm("ajk", id, 99_500)).error?.message).toContain("your own count");
    expect((await confirm("bendahari", id, 99_500)).data).toBe("confirmed");
    expect((await postings(id))[0].amount_sen).toBe(99_500);
  });
});

describe("cancelling a count", () => {
  it("the counter can cancel their own count, with a reason", async () => {
    const id = await count("ajk");
    const ajk = await userClient("a", "ajk");
    expect((await ajk.rpc("cancel_collection", { p_id: id, p_reason: " " })).error?.message).toContain("reason is required");
    expect((await ajk.rpc("cancel_collection", { p_id: id, p_reason: "Dimasukkan dua kali" })).error).toBeNull();
    expect((await row(id)).status).toBe("void");
    expect((await confirm("bendahari", id)).error?.message).toContain("was cancelled");
  });

  it("another AJK cannot cancel someone else's count; the Pengerusi can", async () => {
    const id = await count("bendahari");
    expect((await (await userClient("a", "ajk")).rpc("cancel_collection", { p_id: id, p_reason: "x" })).error?.code).toBe(
      PERMISSION_DENIED,
    );
    expect((await (await userClient("a", "pengerusi")).rpc("cancel_collection", { p_id: id, p_reason: "Silap" })).error).toBeNull();
  });

  it("a confirmed count cannot be cancelled or recounted", async () => {
    const id = await count("ajk");
    await confirm("pengerusi", id);
    const bendahari = await userClient("a", "bendahari");
    expect((await bendahari.rpc("cancel_collection", { p_id: id, p_reason: "Lewat" })).error?.message).toContain("cannot be changed");
    expect((await bendahari.rpc("recount_collection", { p_id: id, p_total_sen: 1 })).error?.message).toContain("cannot be changed");
  });

  it("not even the secret key can change a confirmed count", async () => {
    const id = await count("ajk");
    await confirm("pengerusi", id);
    const { error } = await admin.from("collections").update({ total_sen: 1 }).eq("id", id);
    expect(error?.message).toContain("cannot be changed");
    expect((await admin.from("collections").delete().eq("id", id)).error).not.toBeNull();
  });
});

describe("receipt numbers", () => {
  it("never repeat, even for confirmations at the same moment", async () => {
    const ids = await Promise.all([1, 2, 3, 4, 5].map(() => count("ajk", 1_000)));
    const pengerusi = await userClient("a", "pengerusi");
    const results = await Promise.all(ids.map((id) => pengerusi.rpc("confirm_collection", { p_id: id, p_total_sen: 1_000 })));
    expect(results.every((result) => result.data === "confirmed")).toBe(true);

    const numbers = (await Promise.all(ids.map(postings))).map((rows) => rows[0].receipt_no as string);
    expect(new Set(numbers).size).toBe(5);
    const sequence = numbers.map((number) => Number(number.split("-")[2])).sort((a, b) => a - b);
    expect(sequence.at(-1)! - sequence[0]).toBe(4);
  });

  it("an app user cannot write a receipt number", async () => {
    const { error } = await (await userClient("a", "bendahari")).from("transactions").insert({
      fund_id: FUND(),
      amount_sen: 100,
      direction: "in",
      date: OPEN_DATE,
      method: "cash",
      receipt_no: "RC-2026-9999",
    });
    expect(error?.code).toBe(PERMISSION_DENIED);
  });

  it("app users cannot change the counter", async () => {
    const { error } = await (await userClient("a", "pengerusi"))
      .from("receipt_counters")
      .update({ last_no: 0 })
      .eq("id", firstRowId("a", "receipt_counters"))
      .select();
    expect(error?.code).toBe(PERMISSION_DENIED);
  });
});

describe("between masjids", () => {
  it("masjid B cannot confirm, recount or cancel masjid A's count", async () => {
    const id = await count("ajk");
    const b = await userClient("b", "pengerusi");
    expect((await b.rpc("confirm_collection", { p_id: id, p_total_sen: 142_050 })).error?.message).toContain("not found");
    expect((await b.rpc("cancel_collection", { p_id: id, p_reason: "serang" })).error?.message).toContain("not found");
    const bendahariB = await userClient("b", "bendahari");
    expect((await bendahariB.rpc("recount_collection", { p_id: id, p_total_sen: 1 })).error?.message).toContain("not found");
    expect((await row(id)).status).toBe("counted");
  });

  it("the same key in two masjids makes two separate counts", async () => {
    const key = crypto.randomUUID();
    const a = await (await userClient("a", "bendahari")).rpc("record_collection", {
      p_key: key,
      p_date: OPEN_DATE,
      p_fund_id: FUND(),
      p_total_sen: 100,
    });
    const b = await (await userClient("b", "bendahari")).rpc("record_collection", {
      p_key: key,
      p_date: OPEN_DATE,
      p_fund_id: firstRowId("b", "funds"),
      p_total_sen: 100,
    });
    expect(a.error).toBeNull();
    expect(b.error).toBeNull();
    expect(a.data).not.toBe(b.data);
  });

  it("visitors who are not signed in can do nothing", async () => {
    const { error } = await anon.rpc("record_collection", {
      p_key: crypto.randomUUID(),
      p_date: OPEN_DATE,
      p_fund_id: FUND(),
      p_total_sen: 100,
    });
    expect(error).not.toBeNull();
    expect((await anon.rpc("confirm_collection", { p_id: crypto.randomUUID(), p_total_sen: 1 })).error).not.toBeNull();
  });
});
