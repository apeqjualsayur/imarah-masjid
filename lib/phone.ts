// Malaysian phone numbers. Stored as digits with the leading 0
// (for example 0123456789), whatever way they were typed or pasted.

export type PhoneResult =
  | { ok: true; value: string | null }
  | { ok: false; error: "phone_bad" | "phone_excel" };

/**
 * Cleans a phone number. Empty is allowed (null). Repairs what Excel and
 * people usually do: spaces, dashes, +60 or 60 in front, and a lost leading 0.
 */
export function normalisePhone(input: string | null | undefined): PhoneResult {
  const raw = (input ?? "").trim();
  if (!raw) return { ok: true, value: null };

  // Excel turned the number into 1.23457E+09: the digits are already lost.
  if (/^\d+([.,]\d+)?e\+?\d+$/i.test(raw)) return { ok: false, error: "phone_excel" };

  let digits = raw.replace(/[\s\-.()/]/g, "");
  if (digits.startsWith("+")) digits = digits.slice(1);
  if (!/^\d+$/.test(digits)) return { ok: false, error: "phone_bad" };

  if (digits.startsWith("60") && digits.length >= 10) digits = `0${digits.slice(2)}`;
  else if (!digits.startsWith("0") && digits.length >= 8 && digits.length <= 10) digits = `0${digits}`;

  const mobile = /^01\d{8,9}$/.test(digits);
  const landline = /^0[2-9]\d{7,8}$/.test(digits);
  return mobile || landline ? { ok: true, value: digits } : { ok: false, error: "phone_bad" };
}

/** "012-345 6789", "011-1234 5678", "03-1234 5678", "082-123 456". */
export function formatPhone(phone: string) {
  const area = phone.startsWith("01") || /^0[89]/.test(phone) ? 3 : 2;
  const head = phone.slice(0, area);
  const rest = phone.slice(area);
  const split = rest.length > 6 ? rest.length - 4 : 3;
  return `${head}-${rest.slice(0, split)} ${rest.slice(split)}`;
}

/** A wa.me link for a mobile number, or null for landlines. */
export function whatsappLink(phone: string) {
  return phone.startsWith("01") ? `https://wa.me/6${phone}` : null;
}
