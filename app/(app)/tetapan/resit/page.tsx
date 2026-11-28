import { getTranslations } from "next-intl/server";
import { BackLink } from "@/components/BackLink";
import { createClient } from "@/lib/supabase/server";
import { requireMember } from "@/lib/session";
import { CreditForm } from "./form";

export default async function ReceiptSettingsPage() {
  const { masjid } = await requireMember("settings.manage");
  const [t, s] = await Promise.all([getTranslations("resitTetapan"), getTranslations("settings")]);

  const supabase = await createClient();
  const { data } = await supabase.from("masjids").select("receipt_hide_credit").eq("id", masjid.id).single();

  return (
    <>
      <BackLink href="/tetapan" label={s("title")} />
      <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
      <p className="mt-1 text-muted">{t("lead")}</p>

      <section aria-labelledby="kredit" className="mt-5 max-w-2xl rounded-card bg-surface p-5">
        <h2 id="kredit" className="text-lg font-bold">
          {t("creditTitle")}
        </h2>
        {masjid.plan === "asas" ? (
          <p className="mt-1 text-sm text-muted">{t("creditAsas")}</p>
        ) : (
          <CreditForm hidden={data?.receipt_hide_credit ?? false} />
        )}
      </section>
    </>
  );
}
