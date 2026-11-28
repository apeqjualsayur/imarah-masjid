import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { MasjidLogo } from "@/components/MasjidLogo";
import { PrintButton } from "@/components/PrintButton";
import { QrCode } from "@/components/QrCode";
import { checkDuitNow } from "@/lib/duitnow";
import { can } from "@/lib/permissions";
import { areaLine, getLogoUrl, requireMember } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

/**
 * "Terima derma": the masjid's DuitNow QR, large, for a donor to scan, or to
 * print as a poster. The app only shows the QR; money goes straight to the
 * masjid's bank account.
 */
export default async function DermaPage() {
  const { masjid, role } = await requireMember("dashboard.view");
  const t = await getTranslations("derma");

  const supabase = await createClient();
  const [{ data }, logoUrl] = await Promise.all([
    supabase.from("masjids").select("duitnow_payload").eq("id", masjid.id).single(),
    getLogoUrl(masjid.logo_path),
  ]);
  const qr = data?.duitnow_payload ? checkDuitNow(data.duitnow_payload) : null;

  if (!qr?.ok) {
    return (
      <>
        <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
        <div className="mt-5 max-w-2xl rounded-card bg-surface p-6" data-testid="derma-tiada">
          <p className="font-semibold">{t("noneTitle")}</p>
          <p className="mt-1 text-muted">{can(role, "settings.manage") ? t("noneSetUp") : t("noneAsk")}</p>
          {can(role, "settings.manage") ? (
            <Link
              href="/tetapan/duitnow"
              className="mt-4 inline-flex min-h-tap items-center rounded-chip bg-primary px-4 font-semibold text-surface"
            >
              {t("setUp")}
            </Link>
          ) : null}
        </div>
      </>
    );
  }

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3 print:hidden">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
          <p className="mt-1 text-muted">{t("lead")}</p>
        </div>
        <PrintButton label={t("print")} />
      </div>

      <section
        aria-label={t("posterLabel")}
        className="mx-auto mt-6 flex max-w-md flex-col items-center rounded-panel bg-surface p-6 text-center print:mt-0 print:max-w-none print:rounded-none print:p-0"
        data-testid="derma-poster"
      >
        <MasjidLogo name={masjid.name} src={logoUrl} className="size-16 print:size-24" />
        <h2 className="mt-3 text-2xl font-bold print:text-4xl">{masjid.name}</h2>
        {areaLine(masjid) ? <p className="text-muted print:text-xl">{areaLine(masjid)}</p> : null}

        <p className="mt-5 text-lg font-semibold print:mt-10 print:text-3xl">{t("scan")}</p>
        <div className="mt-3 rounded-card border border-border p-3 print:mt-6 print:border-0">
          <QrCode text={qr.payload} label={t("qrLabel", { name: masjid.name })} className="size-64 sm:size-72 print:size-[12cm]" />
        </div>
        {qr.name ? (
          <p className="mt-3 text-sm text-muted print:mt-6 print:text-xl">
            {t("recipient")} <span className="font-semibold text-ink">{qr.name}</span>
          </p>
        ) : null}
        <p className="mt-4 text-sm text-muted print:mt-8 print:text-lg">{t("direct")}</p>
      </section>
    </>
  );
}
