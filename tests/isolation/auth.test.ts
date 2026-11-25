import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { masjidId, seedEmail, seedInviteToken } from "../../scripts/seed-data";
import { admin, anon, newUser, PERMISSION_DENIED, userClient, userId } from "./helpers";
import { totp } from "./totp";

const MASJID_A = masjidId("a");
const sha256 = (value: string) => createHash("sha256").update(value, "utf8").digest("hex");

/** Pengerusi A invites someone and gets the link token back. */
async function invite(email: string, role = "bendahari") {
  const client = await userClient("a", "pengerusi");
  // Like the app: a new invitation replaces any open one for the same email.
  await client
    .from("invitations")
    .update({ revoked_at: new Date().toISOString() })
    .eq("email", email)
    .is("accepted_at", null)
    .is("revoked_at", null);
  const token = crypto.randomUUID();
  const { data, error } = await client
    .from("invitations")
    .insert({ email, role, token_hash: sha256(token) })
    .select("id")
    .single();
  expect(error).toBeNull();
  return { token, id: data!.id as string };
}

async function accept(client: SupabaseClient, token: string) {
  return client.rpc("accept_invitation", { p_token: token });
}

async function membershipOf(id: string) {
  const { data } = await admin.from("memberships").select("masjid_id, role, status").eq("user_id", id).maybeSingle();
  return data;
}

describe("creating a masjid", () => {
  const form = { p_name: "Surau Ujian", p_state: "Selangor", p_address: "1 Jalan Ujian", p_prayer_zone: "SGR01" };

  it("a new user becomes Pengerusi of the masjid they create", async () => {
    const user = await newUser();
    const { data: id, error } = await user.client.rpc("create_masjid", form);
    expect(error).toBeNull();
    expect(await membershipOf(user.id)).toEqual({ masjid_id: id, role: "pengerusi", status: "active" });

    const { data: masjid } = await user.client.from("masjids").select("name, plan").single();
    expect(masjid).toEqual({ name: "Surau Ujian", plan: "asas" });
  });

  it("the same user cannot create a second masjid", async () => {
    const user = await newUser();
    expect((await user.client.rpc("create_masjid", form)).error).toBeNull();
    const { error } = await user.client.rpc("create_masjid", form);
    expect(error?.message).toContain("already_member");
  });

  it("a member of another masjid cannot create one", async () => {
    const client = await userClient("a", "bendahari");
    const { error } = await client.rpc("create_masjid", form);
    expect(error?.message).toContain("already_member");
  });

  it("a visitor who is not signed in cannot", async () => {
    expect((await anon.rpc("create_masjid", form)).error).not.toBeNull();
  });

  it("a name is required", async () => {
    const user = await newUser();
    const { error } = await user.client.rpc("create_masjid", { ...form, p_name: "  " });
    expect(error?.message).toContain("name_required");
  });
});

describe("invitations", () => {
  it("the invited person joins masjid A with the invited role, once", async () => {
    const user = await newUser();
    const { token } = await invite(user.email, "bendahari");

    const { data: preview } = await anon.rpc("invitation_preview", { p_token: token });
    expect(preview).toEqual([
      { masjid_name: "Masjid Contoh A", role: "bendahari", email: user.email, status: "pending" },
    ]);

    const { data, error } = await accept(user.client, token);
    expect(error).toBeNull();
    expect(data).toBe(MASJID_A);
    expect(await membershipOf(user.id)).toEqual({ masjid_id: MASJID_A, role: "bendahari", status: "active" });

    expect((await accept(user.client, token)).error?.message).toContain("invitation_used");
    const { data: after } = await anon.rpc("invitation_preview", { p_token: token });
    expect(after[0].status).toBe("used");
  });

  it("only works for the invited email", async () => {
    const invited = await newUser();
    const someoneElse = await newUser();
    const { token } = await invite(invited.email);

    const { error } = await accept(someoneElse.client, token);
    expect(error?.message).toContain("invitation_wrong_email");
    expect(await membershipOf(someoneElse.id)).toBeNull();
  });

  it("a revoked invitation cannot be used", async () => {
    const user = await newUser();
    const { token, id } = await invite(user.email);
    const pengerusi = await userClient("a", "pengerusi");
    await pengerusi.from("invitations").update({ revoked_at: new Date().toISOString() }).eq("id", id);

    expect((await accept(user.client, token)).error?.message).toContain("invitation_revoked");
    expect(await membershipOf(user.id)).toBeNull();
  });

  it("an expired invitation cannot be used", async () => {
    const user = await newUser();
    const token = crypto.randomUUID();
    await admin.from("invitations").insert({
      masjid_id: MASJID_A,
      email: user.email,
      role: "ajk",
      token_hash: sha256(token),
      invited_by: await userId("a", "pengerusi"),
      expires_at: "2020-01-01T00:00:00Z",
    });

    expect((await accept(user.client, token)).error?.message).toContain("invitation_expired");
  });

  it("an unknown link shows nothing and joins nothing", async () => {
    const user = await newUser();
    const { data } = await anon.rpc("invitation_preview", { p_token: "tiada-pautan-ini" });
    expect(data).toEqual([]);
    expect((await accept(user.client, "tiada-pautan-ini")).error?.message).toContain("invitation_not_found");
  });

  it("a member of masjid B cannot join masjid A", async () => {
    const { token } = await invite(seedEmail("b", "bendahari"));
    const client = await userClient("b", "bendahari");
    expect((await accept(client, token)).error?.message).toContain("already_member");
    expect((await membershipOf(await userId("b", "bendahari")))?.masjid_id).toBe(masjidId("b"));
  });

  it("a removed member can be invited back to the same masjid", async () => {
    const user = await newUser();
    const first = await invite(user.email, "ajk");
    expect((await accept(user.client, first.token)).error).toBeNull();

    const pengerusi = await userClient("a", "pengerusi");
    await pengerusi.from("memberships").update({ status: "removed" }).eq("user_id", user.id);
    expect((await membershipOf(user.id))?.status).toBe("removed");

    const second = await invite(user.email, "setiausaha");
    expect((await accept(user.client, second.token)).error).toBeNull();
    expect(await membershipOf(user.id)).toEqual({ masjid_id: MASJID_A, role: "setiausaha", status: "active" });
  });

  it("the seed invitation of masjid B cannot be accepted from masjid A", async () => {
    const client = await userClient("a", "ajk");
    const { error } = await accept(client, seedInviteToken("b"));
    expect(error).not.toBeNull();
  });

  it("a visitor who is not signed in cannot accept", async () => {
    expect((await accept(anon, seedInviteToken("a"))).error).not.toBeNull();
  });
});

describe("the users list", () => {
  it("Pengerusi sees only masjid A's people", async () => {
    const client = await userClient("a", "pengerusi");
    const { data, error } = await client.rpc("masjid_users");
    expect(error).toBeNull();
    const emails = (data as { email: string }[]).map((row) => row.email);
    expect(emails).toContain(seedEmail("a", "bendahari"));
    expect(emails).not.toContain(seedEmail("b", "pengerusi"));

    const { data: members } = await admin.from("memberships").select("user_id").eq("masjid_id", MASJID_A);
    const ids = new Set(members?.map((row) => row.user_id));
    expect((data as { user_id: string }[]).every((row) => ids.has(row.user_id))).toBe(true);
  });

  it.each(["bendahari", "setiausaha", "ajk", "imam"] as const)("%s gets an empty list", async (role) => {
    const client = await userClient("a", role);
    const { data, error } = await client.rpc("masjid_users");
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("a visitor who is not signed in gets nothing", async () => {
    expect((await anon.rpc("masjid_users")).error).not.toBeNull();
  });
});

describe("the platform admin", () => {
  it("masjid users cannot use admin functions", async () => {
    const client = await userClient("a", "pengerusi");
    expect((await client.rpc("admin_list_masjids")).error?.code).toBe(PERMISSION_DENIED);
    const { error } = await client.rpc("admin_set_plan", { p_masjid_id: MASJID_A, p_plan: "pro" });
    expect(error?.code).toBe(PERMISSION_DENIED);
  });

  it("visitors who are not signed in cannot", async () => {
    expect((await anon.rpc("admin_list_masjids")).error).not.toBeNull();
  });

  it("an admin without 2-step verification cannot", async () => {
    const user = await newUser({ platform_admin: true });
    expect((await user.client.rpc("admin_list_masjids")).error?.message).toContain("not_platform_admin");
  });

  it("an admin cannot join or create a masjid", async () => {
    const user = await newUser({ platform_admin: true });
    const { error } = await user.client.rpc("create_masjid", {
      p_name: "Tidak boleh",
      p_state: "Selangor",
      p_address: "",
      p_prayer_zone: "SGR01",
    });
    expect(error?.message).toContain("platform_admin");
  });

  it("an admin with 2-step verification can list masjids and set a plan, and both are logged", async () => {
    const user = await newUser({ platform_admin: true });
    const { data: factor, error: enrolError } = await user.client.auth.mfa.enroll({ factorType: "totp" });
    expect(enrolError).toBeNull();
    const { error: verifyError } = await user.client.auth.mfa.challengeAndVerify({
      factorId: factor!.id,
      code: totp(factor!.totp.secret),
    });
    expect(verifyError).toBeNull();

    const started = new Date().toISOString();
    const { data: list, error } = await user.client.rpc("admin_list_masjids");
    expect(error).toBeNull();
    expect((list as { id: string }[]).some((row) => row.id === MASJID_A)).toBe(true);

    const { data: before } = await admin.from("masjids").select("plan").eq("id", MASJID_A).single();
    expect((await user.client.rpc("admin_set_plan", { p_masjid_id: MASJID_A, p_plan: "pro" })).error).toBeNull();
    expect((await admin.from("masjids").select("plan").eq("id", MASJID_A).single()).data?.plan).toBe("pro");
    await user.client.rpc("admin_set_plan", { p_masjid_id: MASJID_A, p_plan: before!.plan });

    const { data: log } = await admin
      .from("audit_log")
      .select("action")
      .eq("masjid_id", MASJID_A)
      .eq("user_id", user.id)
      .gte("at", started);
    const actions = log?.map((row) => row.action);
    expect(actions).toContain("VIEW");
    expect(actions).toContain("UPDATE");

    // Pengerusi A can see that the admin looked.
    const pengerusi = await userClient("a", "pengerusi");
    const { data: visible } = await pengerusi
      .from("audit_log")
      .select("action")
      .eq("user_id", user.id)
      .eq("action", "VIEW");
    expect(visible?.length).toBeGreaterThan(0);
  });

  it("an unknown plan is refused", async () => {
    const { error } = await admin.from("masjids").update({ plan: "emas" }).eq("id", MASJID_A);
    expect(error).not.toBeNull();
  });
});
