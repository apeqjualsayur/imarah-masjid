import { beforeAll, describe, expect, it } from "vitest";
import { firstRowId, type Role } from "../../scripts/seed-data";
import { admin, anon, PERMISSION_DENIED, userClient, userId } from "./helpers";

const NOT_EDITORS: Role[] = ["pengerusi", "bendahari", "ajk", "imam"];

/** A fresh household in masjid A, made by its Setiausaha. */
async function newHousehold() {
  const client = await userClient("a", "setiausaha");
  const { data, error } = await client
    .from("households")
    .insert({ head_name: `Ujian ${crypto.randomUUID()}`, phone: "0123456789" })
    .select("id")
    .single();
  expect(error).toBeNull();
  return data!.id as string;
}

describe("members of a household", () => {
  let household: string;
  beforeAll(async () => {
    household = await newHousehold();
  });

  it("Setiausaha adds, edits and removes a member", async () => {
    const client = await userClient("a", "setiausaha");
    const { data, error } = await client
      .from("members")
      .insert({ household_id: household, name: "Anak Ujian", relation: "anak", ic_last4: "1234" })
      .select("id")
      .single();
    expect(error).toBeNull();
    const id = data!.id;

    expect((await client.from("members").update({ relation: "isteri" }).eq("id", id).select()).data).toHaveLength(1);
    expect((await client.from("members").delete().eq("id", id).select()).data).toHaveLength(1);
  });

  it.each(NOT_EDITORS)("%s cannot add a member", async (role) => {
    const client = await userClient("a", role);
    const { error } = await client.from("members").insert({ household_id: household, name: "Tidak Boleh" });
    expect(error?.code).toBe(PERMISSION_DENIED);
  });

  it.each(NOT_EDITORS)("%s cannot edit or delete a household", async (role) => {
    const client = await userClient("a", role);
    const edit = await client.from("households").update({ head_name: "diubah" }).eq("id", household).select();
    if (edit.error) expect(edit.error.code).toBe(PERMISSION_DENIED);
    else expect(edit.data).toEqual([]);
    const remove = await client.from("households").delete().eq("id", household).select();
    if (remove.error) expect(remove.error.code).toBe(PERMISSION_DENIED);
    else expect(remove.data).toEqual([]);
    expect((await admin.from("households").select("id").eq("id", household)).data).toHaveLength(1);
  });

  it("a full IC number cannot be stored", async () => {
    const client = await userClient("a", "setiausaha");
    const { error } = await client.from("members").insert({ household_id: household, name: "KP Penuh", ic_last4: "850101145678" });
    expect(error).not.toBeNull();
  });
});

describe("WhatsApp consent", () => {
  it("cannot be yes without a date", async () => {
    const id = await newHousehold();
    const client = await userClient("a", "setiausaha");
    const { error } = await client.from("households").update({ whatsapp_opt_in: true }).eq("id", id);
    expect(error).not.toBeNull();
  });

  it("is saved with its date", async () => {
    const id = await newHousehold();
    const client = await userClient("a", "setiausaha");
    const at = new Date().toISOString();
    const { error } = await client
      .from("households")
      .update({ whatsapp_opt_in: true, whatsapp_consent_at: at })
      .eq("id", id);
    expect(error).toBeNull();
  });
});

describe("the change history", () => {
  let household: string;
  let setiausaha: string;

  beforeAll(async () => {
    household = await newHousehold();
    setiausaha = await userId("a", "setiausaha");
    const client = await userClient("a", "setiausaha");
    await client.from("households").update({ head_name: "Nama Baharu", address: "Alamat baharu" }).eq("id", household);
    await client.from("members").insert({ household_id: household, name: "Ahli Sejarah" });
  });

  it("records who edited, and that personal fields changed without their values", async () => {
    const { data } = await admin
      .from("audit_log")
      .select("user_id, before, after")
      .eq("table_name", "households")
      .eq("row_id", household)
      .eq("action", "UPDATE");
    expect(data).toHaveLength(1);
    expect(data![0].user_id).toBe(setiausaha);
    expect(data![0].after.head_name).toBe("[changed]");
    expect(JSON.stringify(data)).not.toContain("Nama Baharu");
  });

  it.each(["pengerusi", "bendahari"] as Role[])("%s sees the household's history", async (role) => {
    const client = await userClient("a", role);
    const { data, error } = await client.rpc("household_history", { p_household_id: household });
    expect(error).toBeNull();
    const actions = (data as { table_name: string; action: string }[]).map((row) => `${row.table_name}:${row.action}`);
    expect(actions).toEqual(expect.arrayContaining(["households:INSERT", "households:UPDATE", "members:INSERT"]));
  });

  it.each(["setiausaha", "ajk", "imam"] as Role[])("%s gets no history", async (role) => {
    const client = await userClient("a", role);
    const { data } = await client.rpc("household_history", { p_household_id: household });
    expect(data).toEqual([]);
  });

  it("masjid B's Pengerusi gets nothing for masjid A's household", async () => {
    const client = await userClient("b", "pengerusi");
    const { data } = await client.rpc("household_history", { p_household_id: household });
    expect(data).toEqual([]);
  });

  it("masjid A's Pengerusi gets nothing for masjid B's household", async () => {
    const client = await userClient("a", "pengerusi");
    const { data } = await client.rpc("household_history", { p_household_id: firstRowId("b", "households") });
    expect(data).toEqual([]);
  });

  it("visitors who are not signed in get nothing", async () => {
    expect((await anon.rpc("household_history", { p_household_id: household })).error).not.toBeNull();
  });
});

describe("importing", () => {
  it("a batch import cannot write into masjid B", async () => {
    const client = await userClient("a", "setiausaha");
    const { error } = await client.from("households").insert([
      { head_name: "Import A" },
      { head_name: "Import B", masjid_id: firstRowId("b", "masjids") },
    ]);
    expect(error?.code).toBe(PERMISSION_DENIED);
    const { data } = await admin.from("households").select("id").eq("head_name", "Import B");
    expect(data).toEqual([]);
  });
});
