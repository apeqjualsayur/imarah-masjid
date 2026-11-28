import { getTranslations } from "next-intl/server";
import { BackLink } from "@/components/BackLink";
import { PlanForm } from "@/components/khairat/forms";
import { todayInMalaysia } from "@/lib/cashbook";
import { senToPlain } from "@/lib/money";
import { loadFunds } from "../../kewangan/data";
import { loadPlans, requireKhairat } from "../data";

export default async function KhairatSetupPage({ searchParams }: PageProps<"/khairat/tetapan">) {
  await requireKhairat("khairat.setup");
  const [t, params, plans, funds] = await Promise.all([getTranslations("khairat"), searchParams, loadPlans(), loadFunds()]);

  const thisYear = Number(todayInMalaysia().slice(0, 4));
  const requested = Number(typeof params.tahun === "string" ? params.tahun : "");
  const year = Number.isInteger(requested) && requested >= 2000 && requested <= 2100 ? requested : thisYear;
  const existing = plans.find((plan) => plan.year === year) ?? null;
  // A new year starts from the latest setup, so only what changed needs typing.
  const previous = plans.find((plan) => plan.year < year) ?? null;

  const openFunds = funds.filter((fund) => !fund.archived_at || fund.id === existing?.fund_id);
  const khairatFund = openFunds.find((fund) => /^khairat/i.test(fund.name));
  const source = existing ?? previous;

  return (
    <>
      <BackLink href={`/khairat?tahun=${year}`} label={t("title")} />
      <h1 className="text-3xl font-bold tracking-tight">{existing ? t("setupEditTitle", { year }) : t("setupNewTitle", { year })}</h1>
      <p className="mt-1 text-muted">{t("setupLead")}</p>
      <PlanForm
        id={existing?.id ?? null}
        yearFixed={!!existing}
        funds={openFunds.map((fund) => ({ id: fund.id, name: fund.name }))}
        initial={{
          year: String(year),
          fee: source ? senToPlain(source.fee_sen) : "",
          coverage: source?.coverage ?? "household",
          pay_by: existing?.pay_by ?? `${year}-${(previous?.pay_by ?? "0000-03-31").slice(5)}`,
          fund_id: source?.fund_id ?? khairatFund?.id ?? "",
        }}
      />
    </>
  );
}
