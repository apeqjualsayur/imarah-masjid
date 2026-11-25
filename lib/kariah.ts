// Small rules for the kariah registry, shared by forms, import and tests.

export const RELATIONS = ["isteri", "suami", "anak", "ibu", "bapa", "lain"] as const;
export type Relation = (typeof RELATIONS)[number];

export function isRelation(value: unknown): value is Relation {
  return RELATIONS.includes(value as Relation);
}

export const NAME_MAX = 120;
export const ADDRESS_MAX = 300;

/**
 * Keeps only the last 4 digits of an IC number. A full 12-digit IC (with or
 * without dashes) is cut down to its last 4 here, so it is never stored.
 */
export function icLast4(input: string | null | undefined): { ok: true; value: string | null } | { ok: false } {
  const digits = (input ?? "").replace(/[\s-]/g, "");
  if (!digits) return { ok: true, value: null };
  if (!/^\d+$/.test(digits)) return { ok: false };
  if (digits.length === 4 || digits.length === 12) return { ok: true, value: digits.slice(-4) };
  return { ok: false };
}

/** Age in whole years on a day, from a yyyy-mm-dd date of birth. */
export function ageOn(dateOfBirth: string, today: Date) {
  const [year, month, day] = dateOfBirth.split("-").map(Number);
  let age = today.getUTCFullYear() - year;
  const beforeBirthday =
    today.getUTCMonth() + 1 < month || (today.getUTCMonth() + 1 === month && today.getUTCDate() < day);
  if (beforeBirthday) age -= 1;
  return age;
}

/** A real yyyy-mm-dd date, not in the future and not before 1900. */
export function isValidBirthDate(value: string, today: Date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) return false;
  return date.getUTCFullYear() >= 1900 && date.getTime() <= today.getTime();
}

/** For matching duplicates: lower case, single spaces, no punctuation. */
export function matchKey(value: string | null | undefined) {
  return (value ?? "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}
