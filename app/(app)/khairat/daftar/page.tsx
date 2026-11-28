import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { BackLink } from "@/components/BackLink";
import { EnrolForm } from "@/components/khairat/forms";
import { formatSen } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";
import { loadMemberships, loadPlans, requireKhairat } from "../data";

export default async function KhairatEnrolPage({ searchParams }: PageProps<"/khairat/daftar">) {
  await requireKhairat("khairat.record");
  const [t, params, plans, memberships] = await Promise.all([getTranslations("khairat"), searchParams, loadPlans(), loadMemberships()]);

  const requested = Number(typeof params.tahun === "string" ? params.tahun : "");
  const plan = plans.find((item) => item.year === requested) ?? plans[0];
  if (!plan) {
    return (
      <>
        <BackLink href="/khairat" label={t("title")} />
        <p className="mt-5 rounded-card bg-surface p-6 text-muted">{t("noSetupOthers")}</p>
      </>
    );
  }

  const supabase = await createClient();
  const { data } = await supabase.from("households").select("id, head_name, address").order("head_name").limit(5000);
  const enrolled = new Set(memberships.filter((row) => row.year === plan.year).map((row) => row.household_id));
  const households = ((data ?? []) as { id: string; head_name: string; address: string | null }[]).filter((h) => !enrolled.has(h.id));

  return (
    <>
      <BackLink href={`/khairat?tahun=${plan.year}`} label={t("title")} />
      <h1 className="text-3xl font-bold tracking-tight">{t("enrolTitle", { year: plan.year })}</h1>
      <p className="mt-1 text-muted">
        {t("enrolLead", { fee: formatSen(plan.fee_sen), coverage: t(`per.${plan.coverage}`) })}
      </p>
      {households.length === 0 ? (
        <p className="mt-5 rounded-card bg-surface p-6 text-muted">
          {t("allEnrolled")}{" "}
          <Link href="/kariah" className="font-semibold text-primary-dark underline underline-offset-4">
            {t("toKariah")}
          </Link>
        </p>
      ) : (
        <EnrolForm year={plan.year} households={households} />
      )}
    </>
  );
}
