import "server-only";
import { getLocale, getTranslations } from "next-intl/server";
import {
  AUDIT_GROUPS,
  auditChanges,
  auditKind,
  dayRange,
  groupOf,
  isAuditAction,
  isAuditGroup,
  type AuditAction,
  type AuditGroup,
  type AuditRow,
  type AuditValue,
} from "@/lib/audit";
import { isIsoDate } from "@/lib/cashbook";
import { formatDateTime, formatDay } from "@/lib/dates";
import { formatSen } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";
import { loadCategories, loadFunds, loadMemberNames } from "../../kewangan/data";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type AuditFilters = { from: string; to: string; user: string; group: AuditGroup | ""; action: AuditAction | "" };

/** Filters from the address bar; anything unexpected is dropped. */
export function readFilters(params: URLSearchParams | Record<string, string | string[] | undefined>): AuditFilters {
  const get = (name: string) => {
    const value = params instanceof URLSearchParams ? params.get(name) : params[name];
    return typeof value === "string" ? value : "";
  };
  const from = get("dari");
  const to = get("hingga");
  const user = get("pengguna");
  const group = get("jenis");
  const action = get("tindakan");
  return {
    from: isIsoDate(from) ? from : "",
    to: isIsoDate(to) ? to : "",
    user: UUID.test(user) || user === "sistem" ? user : "",
    group: isAuditGroup(group) ? group : "",
    action: isAuditAction(action) ? action : "",
  };
}

export function filterQuery(filters: AuditFilters, extra: Record<string, string> = {}) {
  const pairs = { dari: filters.from, hingga: filters.to, pengguna: filters.user, jenis: filters.group, tindakan: filters.action, ...extra };
  return new URLSearchParams(Object.entries(pairs).filter(([, value]) => value)).toString();
}

/** One page of the log (newest first), through row security: the caller's masjid only. */
export async function loadAudit(filters: AuditFilters, offset: number, limit: number): Promise<AuditRow[]> {
  const supabase = await createClient();
  const range = dayRange(filters.from || null, filters.to || null);
  let query = supabase.from("audit_log").select("id, at, user_id, table_name, row_id, action, before, after");
  if (range.from) query = query.gte("at", range.from);
  if (range.to) query = query.lte("at", range.to);
  if (filters.user === "sistem") query = query.is("user_id", null);
  else if (filters.user) query = query.eq("user_id", filters.user);
  if (filters.group) query = query.in("table_name", [...AUDIT_GROUPS[filters.group]]);
  if (filters.action) query = query.eq("action", filters.action);
  const { data, error } = await query
    .order("at", { ascending: false })
    .order("id", { ascending: false })
    .range(offset, offset + limit - 1);
  if (error) throw new Error(error.message);
  return data as AuditRow[];
}

export type ReadableChange = { label: string; before: string | null; after: string | null };
export type ReadableRow = {
  id: string;
  at: string;
  who: string;
  group: string;
  table: string;
  kind: string;
  rowId: string;
  changes: ReadableChange[];
};

/** Turns log rows into plain words: names instead of ids, ringgit, dates, field labels. */
export async function readable(rows: AuditRow[]): Promise<ReadableRow[]> {
  const [t, locale, names, funds, categories] = await Promise.all([
    getTranslations("audit"),
    getLocale(),
    loadMemberNames(),
    loadFunds(),
    loadCategories(),
  ]);
  const fundName = new Map(funds.map((fund) => [fund.id, fund.name]));
  const categoryName = new Map(categories.map((category) => [category.id, category.name]));

  const value = (v: AuditValue | undefined): string | null => {
    if (!v) return null;
    switch (v.kind) {
      case "empty":
        return "—";
      case "hidden":
        return t("hidden");
      case "changed":
        return t("changedHidden");
      case "money":
        return formatSen(v.sen);
      case "bool":
        return v.value ? t("yes") : t("no");
      case "date":
        return formatDay(v.date, locale);
      case "time":
        return formatDateTime(v.iso, locale);
      case "ref":
        if (v.to === "funds") return fundName.get(v.id) ?? t("unknownRecord");
        if (v.to === "categories") return categoryName.get(v.id) ?? t("unknownRecord");
        return names.get(v.id) ?? t("otherUser");
      case "text":
        return v.text;
    }
  };
  const label = (field: string) => (t.has(`fields.${field}`) ? t(`fields.${field}`) : field);

  return rows.map((row) => {
    const group = groupOf(row.table_name);
    return {
      id: row.id,
      at: formatDateTime(row.at, locale),
      who: row.user_id ? (names.get(row.user_id) ?? t("otherUser")) : t("system"),
      group: group ? t(`groups.${group}`) : row.table_name,
      table: t.has(`tables.${row.table_name}`) ? t(`tables.${row.table_name}`) : row.table_name,
      kind: t(`kinds.${auditKind(row)}`),
      rowId: row.row_id,
      changes: auditChanges(row).map((change) => ({ label: label(change.field), before: value(change.before), after: value(change.after) })),
    };
  });
}

/** "Jumlah: RM 50.00 → RM 60.00" for the CSV. */
export function changeText(change: ReadableChange) {
  if (change.before !== null && change.after !== null) return `${change.label}: ${change.before} → ${change.after}`;
  return `${change.label}: ${change.after ?? change.before}`;
}
