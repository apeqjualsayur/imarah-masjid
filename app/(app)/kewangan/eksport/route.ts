import { getTranslations } from "next-intl/server";
import { currentMonth, ledgerCsv, METHODS, parseMonth, type CsvLabels } from "@/lib/cashbook";
import { requireMember } from "@/lib/session";
import { loadCategories, loadFunds, loadLedger } from "../data";

/** The ledger as shown on screen, with the same filters, as a CSV file for Excel. */
export async function GET(request: Request) {
  await requireMember("finance.view");
  const t = await getTranslations("kewangan");
  const params = new URL(request.url).searchParams;

  const [funds, categories] = await Promise.all([loadFunds(), loadCategories()]);
  const month = parseMonth(params.get("bulan")) ?? currentMonth();
  const fund = funds.find((item) => item.id === params.get("dana"))?.id ?? "";
  const category = categories.find((item) => item.id === params.get("kategori"))?.id ?? "";
  const jenis = params.get("jenis");
  const direction = jenis === "in" || jenis === "out" ? jenis : "";

  const { rows, reversed } = await loadLedger({ month, fund, category, direction });
  const fundName = new Map(funds.map((item) => [item.id, item.name]));
  const categoryName = new Map(categories.map((item) => [item.id, item.name]));

  const labels: CsvLabels = {
    headers: [
      t("csv.date"),
      t("csv.ref"),
      t("csv.fund"),
      t("csv.category"),
      t("csv.method"),
      t("csv.note"),
      t("csv.in"),
      t("csv.out"),
      t("csv.status"),
      t("csv.reason"),
    ],
    method: Object.fromEntries(METHODS.map((method) => [method, t(`methods.${method}`)])) as CsvLabels["method"],
    status: { posted: t("csv.posted"), reversed: t("cancelled"), reversal: t("reversal") },
  };

  const csv = ledgerCsv(
    rows.map((row) => ({
      ...row,
      fund: fundName.get(row.fund_id) ?? "",
      category: row.category_id ? (categoryName.get(row.category_id) ?? null) : null,
      status: row.reverses_id ? "reversal" : reversed.has(row.id) ? "reversed" : "posted",
    })),
    labels,
  );

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="lejar-${month}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
