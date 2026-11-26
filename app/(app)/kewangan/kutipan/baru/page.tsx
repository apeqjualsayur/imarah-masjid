import { getTranslations } from "next-intl/server";
import { BackLink } from "@/components/BackLink";
import { CountForm } from "@/components/kutipan/CountForm";
import { PendingQueue } from "@/components/kutipan/PendingQueue";
import { todayInMalaysia } from "@/lib/cashbook";
import { requireMember } from "@/lib/session";
import { loadFunds } from "../../data";

export default async function NewCountPage() {
  const { user } = await requireMember("collections.count");
  const t = await getTranslations("kutipan");
  const funds = (await loadFunds()).filter((fund) => !fund.archived_at);
  const defaultFund = funds.find((fund) => fund.name === "Tabung Am") ?? funds[0];

  return (
    <>
      <BackLink href="/kewangan/kutipan" label={t("title")} />
      <h1 className="text-3xl font-bold tracking-tight">{t("countTitle")}</h1>
      <p className="mt-1 text-muted">{t("countLead")}</p>
      <PendingQueue userId={user.id} />
      {funds.length === 0 ? (
        <p className="mt-6 rounded-card bg-surface p-6 text-muted">{t("noFunds")}</p>
      ) : (
        <div className="max-w-xl">
          <CountForm
            userId={user.id}
            funds={funds.map(({ id, name }) => ({ id, name }))}
            defaultFundId={defaultFund.id}
            today={todayInMalaysia()}
          />
        </div>
      )}
    </>
  );
}
