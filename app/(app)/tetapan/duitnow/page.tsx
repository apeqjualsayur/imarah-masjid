import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { BackLink } from "@/components/BackLink";
import { QrCode } from "@/components/QrCode";
import { checkDuitNow } from "@/lib/duitnow";
import { requireMember } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { DuitNowForm, ReceiptQrForm, RemoveDuitNow } from "./form";

export default async function DuitNowSettingsPage() {
  const { masjid } = await requireMember("settings.manage");
  const [t, s] = await Promise.all([getTranslations("duitnow"), getTranslations("settings")]);

  const supabase = await createClient();
  const { data } = await supabase.from("masjids").select("duitnow_payload, receipt_show_qr").eq("id", masjid.id).single();
  const current = data?.duitnow_payload ?? null;
  const check = current ? checkDuitNow(current) : null;

  return (
    <>
      <BackLink href="/tetapan" label={s("title")} />
      <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
      <p className="mt-1 max-w-2xl text-muted">{t("lead")}</p>

      {check?.ok ? (
        <section aria-labelledby="semasa" className="mt-5 max-w-2xl rounded-card bg-surface p-5">
          <h2 id="semasa" className="text-lg font-bold">
            {t("currentTitle")}
          </h2>
          <div className="mt-3 flex flex-wrap items-center gap-5">
            <QrCode text={check.payload} label={t("currentTitle")} className="size-40" />
            <div>
              <p className="text-sm text-muted">{t("nameInQr")}</p>
              <p className="font-bold" data-testid="duitnow-nama">
                {check.name ?? t("noName")}
              </p>
              <Link href="/derma" className="mt-2 inline-block font-semibold text-primary-dark underline underline-offset-4">
                {t("openDerma")}
              </Link>
            </div>
          </div>
          <RemoveDuitNow />
        </section>
      ) : null}

      <section aria-labelledby="tukar" className="mt-5 max-w-2xl rounded-card bg-surface p-5">
        <h2 id="tukar" className="text-lg font-bold">
          {check?.ok ? t("changeTitle") : t("addTitle")}
        </h2>
        <p className="mt-1 text-sm text-muted">{t("addLead")}</p>
        <DuitNowForm current={check?.ok ? check.payload : null} />
      </section>

      {check?.ok ? (
        <section aria-labelledby="resit" className="mt-5 max-w-2xl rounded-card bg-surface p-5">
          <h2 id="resit" className="text-lg font-bold">
            {t("receiptTitle")}
          </h2>
          <p className="mt-1 text-sm text-muted">{t("receiptLead")}</p>
          <ReceiptQrForm shown={data?.receipt_show_qr ?? false} />
        </section>
      ) : null}
    </>
  );
}
