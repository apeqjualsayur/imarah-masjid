import { getTranslations } from "next-intl/server";
import { BackLink } from "@/components/BackLink";
import { AddCategoryForm, AddFundForm, CategoryRow, FundRow } from "@/components/kewangan/FundForms";
import { planLimit } from "@/lib/plan-limits";
import { requireMember } from "@/lib/session";
import { loadCategories, loadFundSummary } from "../../kewangan/data";

export default async function FundsPage() {
  const { masjid } = await requireMember("funds.manage");
  const t = await getTranslations("dana");
  const [funds, categories] = await Promise.all([loadFundSummary(null, null), loadCategories()]);
  const limit = planLimit(masjid.plan, "funds");
  const openFunds = funds.filter((fund) => !fund.archived_at).length;

  const categoryList = (type: "income" | "expense") => (
    <section aria-labelledby={`kategori-${type}`} className="mt-6">
      <h2 id={`kategori-${type}`} className="text-lg font-bold">
        {type === "income" ? t("incomeCategories") : t("expenseCategories")}
      </h2>
      <ul className="mt-3 divide-y divide-rule rounded-card bg-surface">
        {categories
          .filter((category) => category.type === type)
          .map((category) => (
            <CategoryRow key={category.id} category={category} />
          ))}
        <AddCategoryForm type={type} />
      </ul>
    </section>
  );

  return (
    <>
      <BackLink href="/tetapan" label={t("back")} />
      <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
      <p className="mt-1 text-muted">{t("lead")}</p>

      <section aria-labelledby="dana" className="mt-6">
        <h2 id="dana" className="text-lg font-bold">
          {t("funds")}
        </h2>
        <p className="mt-1 text-sm text-muted">{t("restrictedHelp")}</p>
        {limit !== null ? <p className="mt-1 text-sm text-muted">{t("planNote", { used: openFunds, limit })}</p> : null}
        <ul className="mt-3 divide-y divide-rule rounded-card bg-surface" data-testid="senarai-dana">
          {funds.map((fund) => (
            <FundRow key={fund.id} fund={fund} />
          ))}
          <AddFundForm />
        </ul>
      </section>

      {categoryList("income")}
      {categoryList("expense")}
    </>
  );
}
