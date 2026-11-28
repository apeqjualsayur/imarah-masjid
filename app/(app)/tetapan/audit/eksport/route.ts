import { getTranslations } from "next-intl/server";
import { AUDIT_EXPORT_MAX } from "@/lib/audit";
import { safeCell, todayInMalaysia } from "@/lib/cashbook";
import { toCsv } from "@/lib/csv";
import { requireMember } from "@/lib/session";
import { changeText, loadAudit, readable, readFilters } from "../data";

/** The audit log with the screen's filters, as CSV. Pengerusi only. */
export async function GET(request: Request) {
  await requireMember("audit.export");
  const t = await getTranslations("audit");
  const filters = readFilters(new URL(request.url).searchParams);

  // The database hands back at most 1,000 rows at a time.
  const rows = [];
  for (let offset = 0; offset < AUDIT_EXPORT_MAX; offset += 1000) {
    const page = await loadAudit(filters, offset, 1000);
    rows.push(...page);
    if (page.length < 1000) break;
  }
  const lines = await readable(rows.slice(0, AUDIT_EXPORT_MAX));

  const csv = toCsv([
    [t("csv.at"), t("csv.user"), t("csv.group"), t("csv.table"), t("csv.action"), t("csv.record"), t("csv.changes")],
    ...lines.map((row) => [row.at, row.who, row.group, row.table, row.kind, row.rowId, row.changes.map(changeText).join("; ")].map(safeCell)),
  ]);

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="log-audit-${todayInMalaysia()}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
