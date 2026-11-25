import { describe, expect, it } from "vitest";
import { errorKey } from "@/lib/auth-errors";
import { formatDate } from "@/lib/dates";
import { hashInviteToken, looksLikeEmail, newInviteToken, normaliseEmail } from "@/lib/invitations";
import { isZoneInState, PRAYER_ZONES, STATES } from "@/lib/malaysia";
import { safeNext } from "@/lib/safe-next";

describe("safeNext", () => {
  it.each(["/", "/tetapan", "/jemput/abc"])("keeps %s", (path) => {
    expect(safeNext(path)).toBe(path);
  });

  it.each(["https://jahat.example", "//jahat.example", "/\\jahat.example", "tetapan", null, 5])(
    "refuses %s",
    (value) => {
      expect(safeNext(value)).toBe("/");
    },
  );
});

describe("invitation tokens", () => {
  it("are long, random and safe in a URL", () => {
    const a = newInviteToken();
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(newInviteToken()).not.toBe(a);
  });

  it("hash the same way as the database", () => {
    // encode(sha256(convert_to('abc', 'UTF8')), 'hex') in Postgres.
    expect(hashInviteToken("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });

  it("emails are compared in lower case", () => {
    expect(normaliseEmail("  Ali@Contoh.MY ")).toBe("ali@contoh.my");
    expect(looksLikeEmail("ali@contoh.my")).toBe(true);
    expect(looksLikeEmail("ali@contoh")).toBe(false);
  });
});

describe("errorKey", () => {
  it("maps database errors to message keys", () => {
    expect(errorKey("already_member")).toBe("already_member");
    expect(errorKey("not_platform_admin")).toBe("not_platform_admin");
    expect(errorKey("memberships: the last Pengerusi cannot be removed")).toBe("last_pengerusi");
    expect(errorKey("something unexpected")).toBe("generic");
    expect(errorKey(undefined)).toBe("generic");
  });
});

describe("formatDate", () => {
  it("writes dates the Malaysian way", () => {
    expect(formatDate("2026-10-29T03:00:00Z", "ms")).toBe("29 Okt 2026");
    expect(formatDate("2026-10-29T03:00:00Z", "en")).toBe("29 Oct 2026");
  });

  it("uses Malaysian time, not UTC", () => {
    // 20:00 UTC on 31 Dec is already 1 Jan in Malaysia.
    expect(formatDate("2026-12-31T20:00:00Z", "ms")).toBe("1 Jan 2027");
  });
});

describe("prayer zones", () => {
  it("every state has at least one zone", () => {
    for (const state of STATES) expect(PRAYER_ZONES[state].length).toBeGreaterThan(0);
  });

  it("a zone must belong to the chosen state", () => {
    expect(isZoneInState("Selangor", "SGR01")).toBe(true);
    expect(isZoneInState("Selangor", "JHR01")).toBe(false);
  });
});
