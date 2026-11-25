import { beforeAll, describe, expect, it } from "vitest";
import { masjidId, seedLogoPath, type Role } from "../../scripts/seed-data";
import { admin, anon, userClient } from "./helpers";

const BUCKET = "masjid-logos";
const MASJID_A = masjidId("a");
const MASJID_B = masjidId("b");
const LOGO_A = seedLogoPath("a");
// A file in masjid B's folder for masjid A to try to reach.
const FILE_B = `masjids/${MASJID_B}/rahsia-b.png`;
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]);

const ROLES: Role[] = ["pengerusi", "bendahari", "setiausaha", "ajk", "imam"];
const bucket = async (role: Role) => (await userClient("a", role)).storage.from(BUCKET);

async function existsAsAdmin(path: string) {
  const { data } = await admin.storage.from(BUCKET).download(path);
  return data !== null;
}

beforeAll(async () => {
  const { error } = await admin.storage.from(BUCKET).upload(FILE_B, PNG, { contentType: "image/png", upsert: true });
  if (error) throw new Error(error.message);
  expect(await existsAsAdmin(LOGO_A)).toBe(true);
});

describe.each(ROLES)("%s of masjid A against masjid B's logos", (role) => {
  it("cannot download B's file", async () => {
    const { data, error } = await (await bucket(role)).download(FILE_B);
    expect(data).toBeNull();
    expect(error).not.toBeNull();
  });

  it("cannot make a link to B's file", async () => {
    const { data } = await (await bucket(role)).createSignedUrl(FILE_B, 60);
    expect(data?.signedUrl).toBeFalsy();
  });

  it("sees nothing in B's folder", async () => {
    const { data } = await (await bucket(role)).list(`masjids/${MASJID_B}`);
    expect(data ?? []).toEqual([]);
  });

  it("cannot upload into B's folder", async () => {
    const path = `masjids/${MASJID_B}/serang-${role}.png`;
    const { error } = await (await bucket(role)).upload(path, PNG, { contentType: "image/png" });
    expect(error).not.toBeNull();
    expect(await existsAsAdmin(path)).toBe(false);
  });

  it("cannot overwrite or delete B's file", async () => {
    const storage = await bucket(role);
    await storage.upload(FILE_B, new Uint8Array([1, 2, 3]), { upsert: true, contentType: "image/png" });
    await storage.remove([FILE_B]);
    const { data } = await admin.storage.from(BUCKET).download(FILE_B);
    expect(new Uint8Array(await data!.arrayBuffer())).toEqual(PNG);
  });

  it("can read its own masjid's logo", async () => {
    const { data, error } = await (await bucket(role)).createSignedUrl(LOGO_A, 60);
    expect(error).toBeNull();
    const response = await fetch(data!.signedUrl);
    expect(response.status).toBe(200);
  });
});

describe("writing to the masjid's own folder", () => {
  it.each(["bendahari", "setiausaha", "ajk", "imam"] as Role[])("%s cannot upload a logo", async (role) => {
    const path = `masjids/${MASJID_A}/cuba-${role}.png`;
    const { error } = await (await bucket(role)).upload(path, PNG, { contentType: "image/png" });
    expect(error).not.toBeNull();
    expect(await existsAsAdmin(path)).toBe(false);
  });

  it.each(["bendahari", "setiausaha", "ajk", "imam"] as Role[])("%s cannot delete the logo", async (role) => {
    await (await bucket(role)).remove([LOGO_A]);
    expect(await existsAsAdmin(LOGO_A)).toBe(true);
  });

  it("Pengerusi can upload and delete in A's folder", async () => {
    const storage = await bucket("pengerusi");
    const path = `masjids/${MASJID_A}/ujian-${crypto.randomUUID()}.png`;
    expect((await storage.upload(path, PNG, { contentType: "image/png" })).error).toBeNull();
    expect((await storage.remove([path])).error).toBeNull();
    expect(await existsAsAdmin(path)).toBe(false);
  });

  it("Pengerusi cannot write outside the masjid folder", async () => {
    const storage = await bucket("pengerusi");
    for (const path of ["lain.png", `masjids/lain.png`, `masjids/${MASJID_A}/dalam/lagi.png`]) {
      expect((await storage.upload(path, PNG, { contentType: "image/png" })).error).not.toBeNull();
    }
  });

  it("the bucket refuses other file types and big files", async () => {
    const storage = await bucket("pengerusi");
    const html = await storage.upload(`masjids/${MASJID_A}/x.html`, new TextEncoder().encode("<p>x</p>"), {
      contentType: "text/html",
    });
    expect(html.error).not.toBeNull();
    const big = await storage.upload(`masjids/${MASJID_A}/besar.png`, new Uint8Array(1024 * 1024 + 10), {
      contentType: "image/png",
    });
    expect(big.error).not.toBeNull();
  });
});

describe("the logo setting", () => {
  it("masjid A's logo cannot point at B's file", async () => {
    const client = await userClient("a", "pengerusi");
    const { error } = await client.from("masjids").update({ logo_path: FILE_B }).eq("id", MASJID_A);
    expect(error).not.toBeNull();
  });
});

describe("visitors who are not signed in", () => {
  it("cannot read, list or make links", async () => {
    const storage = anon.storage.from(BUCKET);
    expect((await storage.download(LOGO_A)).data).toBeNull();
    expect((await storage.list(`masjids/${MASJID_A}`)).data ?? []).toEqual([]);
    expect((await storage.createSignedUrl(LOGO_A, 60)).data?.signedUrl).toBeFalsy();
  });

  it("the plain public address does not work: the bucket is private", async () => {
    const { data } = anon.storage.from(BUCKET).getPublicUrl(LOGO_A);
    expect((await fetch(data.publicUrl)).ok).toBe(false);
  });
});
