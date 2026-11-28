// Share links for receipts: /r/<id>.<expiry>.<signature>. The signature is an
// HMAC over the id and expiry with RECEIPT_LINK_SECRET, so a link cannot be
// made or stretched by hand. Pure functions (the secret is passed in) so they
// are easy to test.

import { createHmac, timingSafeEqual } from "node:crypto";

/** Share links work for 30 days. */
export const RECEIPT_LINK_DAYS = 30;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function signature(secret: string, payload: string) {
  return createHmac("sha256", secret).update(`receipt:${payload}`).digest("base64url").slice(0, 32);
}

/** A token for one receipt that stops working after `days`. */
export function makeReceiptToken(secret: string, id: string, now = new Date(), days = RECEIPT_LINK_DAYS): string {
  if (secret.length < 32) throw new Error("RECEIPT_LINK_SECRET is too short");
  if (!UUID.test(id)) throw new Error("not a receipt id");
  const expires = Math.floor(now.getTime() / 1000) + days * 24 * 60 * 60;
  const payload = `${id}.${expires.toString(36)}`;
  return `${payload}.${signature(secret, payload)}`;
}

export type TokenCheck = { ok: true; id: string } | { ok: false; reason: "bad" | "expired" };

/** Checks the signature first, then the expiry. */
export function readReceiptToken(secret: string, token: string, now = new Date()): TokenCheck {
  const parts = token.split(".");
  if (parts.length !== 3 || secret.length < 32) return { ok: false, reason: "bad" };
  const [id, expires36, given] = parts;
  if (!UUID.test(id) || !/^[0-9a-z]{1,10}$/.test(expires36)) return { ok: false, reason: "bad" };

  const expected = Buffer.from(signature(secret, `${id}.${expires36}`));
  const actual = Buffer.from(given);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return { ok: false, reason: "bad" };

  if (parseInt(expires36, 36) * 1000 < now.getTime()) return { ok: false, reason: "expired" };
  return { ok: true, id };
}

/** The secret from the environment, or null when it is not set up. */
export function receiptLinkSecret(): string | null {
  const value = process.env.RECEIPT_LINK_SECRET;
  return value && value.length >= 32 ? value : null;
}
