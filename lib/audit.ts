// Reading the audit log: which record types belong together, what changed in
// a row, and each value in a form the screen and CSV can show in plain words.
// Pure functions; personal data was never stored ("[hidden]" / "[changed]").

export const AUDIT_GROUPS = {
  kewangan: ["transactions", "funds", "categories", "receipt_counters"],
  kutipan: ["collections"],
  kariah: ["households", "members"],
  khairat: ["khairat_plans", "khairat_members"],
  bank: ["bank_lines", "bank_formats", "bank_imports"],
  bulan: ["periods", "reports"],
  tetapan: ["masjids", "memberships", "invitations"],
} as const;

export type AuditGroup = keyof typeof AUDIT_GROUPS;
export const isAuditGroup = (value: unknown): value is AuditGroup => typeof value === "string" && value in AUDIT_GROUPS;

export const AUDIT_ACTIONS = ["INSERT", "UPDATE", "DELETE", "VIEW", "EMAIL"] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];
export const isAuditAction = (value: unknown): value is AuditAction => AUDIT_ACTIONS.includes(value as AuditAction);

export const AUDIT_PAGE_SIZE = 50;
export const AUDIT_EXPORT_MAX = 5_000;

export function groupOf(table: string): AuditGroup | null {
  for (const [group, tables] of Object.entries(AUDIT_GROUPS)) if ((tables as readonly string[]).includes(table)) return group as AuditGroup;
  return null;
}

export type AuditRow = {
  id: string;
  at: string;
  user_id: string | null;
  table_name: string;
  row_id: string;
  action: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
};

export type AuditValue =
  | { kind: "empty" }
  | { kind: "hidden" }
  | { kind: "changed" }
  | { kind: "money"; sen: number }
  | { kind: "bool"; value: boolean }
  | { kind: "date"; date: string }
  | { kind: "time"; iso: string }
  | { kind: "ref"; to: "funds" | "categories" | "users"; id: string }
  | { kind: "text"; text: string };

export type FieldChange = { field: string; before?: AuditValue; after?: AuditValue };

/** Bookkeeping columns every row has; they tell the reader nothing. */
const SKIP = new Set(["id", "masjid_id", "created_at", "updated_at", "line_hash", "client_key", "token_hash"]);
const DATE_FIELDS = new Set(["date", "month", "pay_by", "first_date", "last_date", "date_of_birth"]);
const USER_FIELDS = new Set([
  "user_id",
  "created_by",
  "counted_by",
  "confirmed_by",
  "checked_by",
  "voided_by",
  "locked_by",
  "imported_by",
  "cancelled_by",
  "ended_by",
  "generated_by",
  "invited_by",
  "accepted_by",
]);
const TEXT_MAX = 160;

export function auditValue(field: string, raw: unknown): AuditValue {
  if (raw === "[hidden]") return { kind: "hidden" };
  if (raw === "[changed]") return { kind: "changed" };
  if (raw === null || raw === undefined || raw === "") return { kind: "empty" };
  if (Array.isArray(raw) && raw.length === 0) return { kind: "empty" };
  if (field.endsWith("_sen") && typeof raw === "number") return { kind: "money", sen: raw };
  if (typeof raw === "boolean") return { kind: "bool", value: raw };
  if (typeof raw === "string") {
    if (DATE_FIELDS.has(field) && /^\d{4}-\d{2}-\d{2}$/.test(raw)) return { kind: "date", date: raw };
    if (field.endsWith("_at") && !Number.isNaN(Date.parse(raw))) return { kind: "time", iso: raw };
    if (field === "fund_id") return { kind: "ref", to: "funds", id: raw };
    if (field === "category_id") return { kind: "ref", to: "categories", id: raw };
    if (USER_FIELDS.has(field)) return { kind: "ref", to: "users", id: raw };
  }
  const text = typeof raw === "string" ? raw : Array.isArray(raw) ? raw.join(", ") : JSON.stringify(raw);
  return { kind: "text", text: text.length > TEXT_MAX ? `${text.slice(0, TEXT_MAX - 1)}…` : text };
}

const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/**
 * What a row shows: for an addition, the fields it was saved with; for a
 * change, only the fields that changed, before and after; for a removal, what
 * it held. Views and emails carry no fields.
 */
export function auditChanges(row: Pick<AuditRow, "action" | "before" | "after">): FieldChange[] {
  const before = row.before ?? {};
  const after = row.after ?? {};
  if (row.action === "INSERT" || row.action === "DELETE") {
    const source = row.action === "INSERT" ? after : before;
    return Object.entries(source)
      .filter(([field, raw]) => !SKIP.has(field) && auditValue(field, raw).kind !== "empty")
      .map(([field, raw]) => (row.action === "INSERT" ? { field, after: auditValue(field, raw) } : { field, before: auditValue(field, raw) }));
  }
  if (row.action === "UPDATE") {
    const fields = [...new Set([...Object.keys(before), ...Object.keys(after)])];
    return fields
      .filter((field) => !SKIP.has(field) && !same(before[field], after[field]))
      .map((field) => ({ field, before: auditValue(field, before[field]), after: auditValue(field, after[field]) }));
  }
  return [];
}

export type AuditKind = "insert" | "update" | "delete" | "view" | "email" | "lock" | "unlock";

/** The action in words. Locking and unlocking a month get their own names. */
export function auditKind(row: Pick<AuditRow, "table_name" | "action" | "before" | "after">): AuditKind {
  if (row.table_name === "periods") {
    const wasLocked = !!row.before?.locked_at;
    const isLocked = !!row.after?.locked_at;
    if ((row.action === "INSERT" || row.action === "UPDATE") && isLocked && !wasLocked) return "lock";
    if (row.action === "UPDATE" && wasLocked && !isLocked) return "unlock";
  }
  return (row.action.toLowerCase() as AuditKind) ?? "update";
}

/** Start and end of the chosen days in Malaysia time, for filtering `at`. */
export function dayRange(from: string | null, to: string | null) {
  return {
    from: from ? `${from}T00:00:00+08:00` : null,
    to: to ? `${to}T23:59:59.999+08:00` : null,
  };
}
