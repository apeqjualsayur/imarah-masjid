import { createHash, randomBytes } from "node:crypto";

/** A fresh link secret. 32 random bytes, safe to put in a URL. */
export function newInviteToken() {
  return randomBytes(32).toString("base64url");
}

/** Must match the database: encode(sha256(convert_to(token, 'UTF8')), 'hex'). */
export function hashInviteToken(token: string) {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function normaliseEmail(value: string) {
  return value.trim().toLowerCase();
}

export function looksLikeEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}
