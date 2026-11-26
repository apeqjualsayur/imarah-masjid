const THOUSANDS = /\B(?=(\d{3})+(?!\d))/g;

/**
 * Formats an amount in integer sen as "RM 1,234.50".
 * Throws on anything that is not a safe integer: a wrong figure must never
 * reach the screen.
 */
export function formatSen(sen: number): string {
  if (!Number.isSafeInteger(sen)) {
    throw new RangeError(`formatSen expects integer sen, received ${sen}`);
  }

  const abs = Math.abs(sen);
  const remainder = abs % 100;
  const ringgit = (abs - remainder) / 100;
  const whole = String(ringgit).replace(THOUSANDS, ",");
  const cents = String(remainder).padStart(2, "0");

  return `${sen < 0 ? "-" : ""}RM ${whole}.${cents}`;
}

/** "1234.50" or "-12.00": a plain number for spreadsheets, never rounded. */
export function senToPlain(sen: number): string {
  return formatSen(sen).replace("RM ", "").replace(/,/g, "");
}

/** RM 10,000,000.00: well above anything a masjid records in one entry. */
export const MAX_SEN = 1_000_000_000;

export type ParsedAmount = { ok: true; sen: number } | { ok: false; error: "amount_missing" | "amount_bad" | "amount_zero" | "amount_too_big" };

/**
 * Reads an amount typed in ringgit ("1,234.50", "RM 10", "0.5") as integer
 * sen, by its digits only: no floating point, nothing rounded. More than two
 * decimals, negatives and misplaced commas are refused.
 */
export function parseRinggit(input: string): ParsedAmount {
  const text = input.trim().replace(/^rm\s*/i, "").replace(/\s+/g, "");
  if (!text) return { ok: false, error: "amount_missing" };

  const match = /^(\d{1,3}(?:,\d{3})+|\d+)?(?:\.(\d{1,2}))?$/.exec(text);
  if (!match || (match[1] === undefined && match[2] === undefined)) return { ok: false, error: "amount_bad" };

  const ringgit = (match[1] ?? "0").replace(/,/g, "");
  if (ringgit.length > 10) return { ok: false, error: "amount_too_big" };
  const cents = (match[2] ?? "").padEnd(2, "0");
  const sen = Number(ringgit) * 100 + Number(cents);

  if (sen === 0) return { ok: false, error: "amount_zero" };
  if (sen > MAX_SEN) return { ok: false, error: "amount_too_big" };
  return { ok: true, sen };
}
