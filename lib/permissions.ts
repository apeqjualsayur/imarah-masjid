// Mirrors _specs/roles-permissions.md. The database enforces the same rules in
// RLS; this file only decides what the screens show. Change both together.

export const ROLES = ["pengerusi", "bendahari", "setiausaha", "ajk", "imam"] as const;
export type Role = (typeof ROLES)[number];

export function isRole(value: unknown): value is Role {
  return ROLES.includes(value as Role);
}

const P = "pengerusi";
const B = "bendahari";
const S = "setiausaha";
const A = "ajk";
const I = "imam";

// "V" (view only) in the spec counts as allowed for the matching view capability.
export const PERMISSIONS = {
  "dashboard.view": [P, B, S, A, I],
  /** Fund-by-fund balances. The Imam sees totals only. */
  "dashboard.balances": [P, B, S, A],
  "finance.view": [P, B, S, A],
  "kariah.view": [P, B, S, A],
  "kariah.edit": [S],
  "khairat.view": [P, B, S, A],
  "khairat.record": [B, S],
  "khairat.setup": [P, B],
  "transactions.record": [B],
  "transactions.reverse": [P, B],
  /** Create, rename and archive funds and categories. */
  "funds.manage": [P, B],
  "collections.count": [B, A],
  "collections.confirm": [P, B, A],
  "receipts.view": [P, B, S, A],
  "receipts.share": [P, B],
  /** The reconciliation screen, read only. */
  "bank.view": [P, B],
  /** Import statements, match, mark cash, cancel an import. */
  "bank.match": [B],
  /** The month list and lock checklist, read only. */
  "periods.view": [P, B],
  "periods.lock": [P],
  "reports.prepare": [P, B, S],
  "reports.download": [P, B, S],
  "audit.view": [P, B],
  "audit.export": [P],
  "users.manage": [P],
  "settings.manage": [P],
  "plan.view": [P],
} as const satisfies Record<string, readonly Role[]>;

export type Capability = keyof typeof PERMISSIONS;

export function can(role: Role | null | undefined, capability: Capability): boolean {
  if (!role) return false;
  return (PERMISSIONS[capability] as readonly Role[]).includes(role);
}
