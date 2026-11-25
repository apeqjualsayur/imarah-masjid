// Turns an audit log row's before and after into readable changes. The audit
// trigger replaces personal values with "[changed]" or "[hidden]", so those
// fields can only ever say that they changed.

const IGNORED = new Set(["id", "masjid_id", "household_id", "created_at", "updated_at"]);
const MASKS = new Set(["[changed]", "[hidden]"]);

/** Fields the history knows how to name. Anything else is left out. */
export const HISTORY_FIELDS = [
  "head_name",
  "address",
  "phone",
  "whatsapp_opt_in",
  "whatsapp_consent_at",
  "pdpa_consent_at",
  "name",
  "relation",
  "date_of_birth",
  "ic_last4",
] as const;

export type Change = { field: (typeof HISTORY_FIELDS)[number]; personal: boolean; from: string | null; to: string | null };

function show(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "boolean") return value ? "✓" : "✗";
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}T/.test(value)) return value.slice(0, 10);
  return String(value);
}

export function describeChanges(
  before: Record<string, unknown> | null,
  after: Record<string, unknown> | null,
): Change[] {
  if (!before || !after) return [];
  return HISTORY_FIELDS.filter((field) => !IGNORED.has(field) && field in after)
    .filter((field) => JSON.stringify(before[field]) !== JSON.stringify(after[field]) || after[field] === "[changed]")
    .map((field) => {
      const personal = MASKS.has(String(after[field])) || MASKS.has(String(before[field]));
      return { field, personal, from: personal ? null : show(before[field]), to: personal ? null : show(after[field]) };
    });
}
