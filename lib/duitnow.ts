// Reads a DuitNow QR's text (the EMVCo "merchant presented" payload) to check
// it before it is saved and shown to donors. The app only displays the QR;
// money goes straight from the donor's bank to the masjid's bank.

export const DUITNOW_MAX = 512;

export type DuitNowCheck =
  | { ok: true; payload: string; name: string | null; city: string | null }
  | { ok: false; error: "duitnow_missing" | "duitnow_bad" | "duitnow_damaged" | "duitnow_not_malaysia" | "duitnow_too_long" };

/** CRC-16/CCITT-FALSE, the checksum EMVCo QR codes end with. */
export function crc16(text: string): string {
  let crc = 0xffff;
  for (const byte of new TextEncoder().encode(text)) {
    crc ^= byte << 8;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

/** Splits "IDLLvalue..." into fields. Null when the lengths do not add up. */
export function readFields(text: string): Map<string, string> | null {
  const fields = new Map<string, string>();
  let at = 0;
  while (at < text.length) {
    const id = text.slice(at, at + 2);
    const length = Number(text.slice(at + 2, at + 4));
    if (!/^\d{2}$/.test(id) || !/^\d{2}$/.test(text.slice(at + 2, at + 4))) return null;
    const value = text.slice(at + 4, at + 4 + length);
    if (value.length !== length) return null;
    fields.set(id, value);
    at += 4 + length;
  }
  return fields;
}

/**
 * Checks a QR's text: the EMVCo layout, the checksum at the end (so a
 * mistyped or cut-off code is refused), and that it is a Malaysian code.
 * Returns the account name inside it, for the Pengerusi to confirm.
 */
export function checkDuitNow(input: string): DuitNowCheck {
  const payload = input.trim();
  if (!payload) return { ok: false, error: "duitnow_missing" };
  if (payload.length > DUITNOW_MAX) return { ok: false, error: "duitnow_too_long" };
  if (!payload.startsWith("000201") || !/6304[0-9A-Fa-f]{4}$/.test(payload)) return { ok: false, error: "duitnow_bad" };

  const fields = readFields(payload);
  if (!fields || !fields.has("63")) return { ok: false, error: "duitnow_bad" };
  if (crc16(payload.slice(0, -4)) !== payload.slice(-4).toUpperCase()) return { ok: false, error: "duitnow_damaged" };
  if (fields.get("58") !== "MY" || (fields.has("53") && fields.get("53") !== "458")) {
    return { ok: false, error: "duitnow_not_malaysia" };
  }

  return { ok: true, payload, name: fields.get("59")?.trim() || null, city: fields.get("60")?.trim() || null };
}
