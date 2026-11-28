import { getTranslations } from "next-intl/server";
import { todayInMalaysia } from "@/lib/cashbook";
import { earlierArrears, khairatCsv, statusOf, STATUSES, type KhairatStatus } from "@/lib/khairat";
import { loadMemberships, loadPlans, requireKhairat } from "../data";

/** The khairat list as shown on screen, with the same filters, as a CSV file for Excel. */
export async function GET(request: Request) {
  await requireKhairat("khairat.view");
  const t = await getTranslations("khairat");
  const params = new URL(request.url).searchParams;
  const today = todayInMalaysia();

  const [plans, memberships] = await Promise.all([loadPlans(), loadMemberships()]);
  const plan = plans.find((item) => item.year === Number(params.get("tahun"))) ?? plans[0];
  if (!plan) return new Response("", { status: 404 });

  const status = STATUSES.includes(params.get("status") as KhairatStatus) ? (params.get("status") as KhairatStatus) : null;
  const q = (params.get("cari") ?? "").trim().toLowerCase().slice(0, 80);
  const rows = memberships.filter(
    (row) => row.year === plan.year && (!status || statusOf(row, today) === status) && (!q || row.head_name.toLowerCase().includes(q)),
  );

  const csv = khairatCsv(rows, earlierArrears(memberships, plan.year, today), today, {
    headers: [t("csv.head"), t("csv.year"), t("csv.people"), t("csv.due"), t("csv.paid"), t("csv.owed"), t("csv.status"), t("csv.earlier")],
    status: { aktif: t("statuses.aktif"), tunggakan: t("statuses.tunggakan"), tamat: t("statuses.tamat") },
  });

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="khairat-${plan.year}${status ? `-${status}` : ""}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
