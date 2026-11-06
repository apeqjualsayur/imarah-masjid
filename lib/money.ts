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
