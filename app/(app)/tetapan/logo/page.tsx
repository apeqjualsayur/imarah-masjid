import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { MasjidLogo } from "@/components/MasjidLogo";
import { getLogoUrl, requireMember } from "@/lib/session";
import { LogoForms } from "./forms";

export default async function LogoPage() {
  const { masjid } = await requireMember("settings.manage");
  const logoUrl = await getLogoUrl(masjid.logo_path);
  const t = await getTranslations("logo");

  return (
    <>
      <Link href="/tetapan" className="inline-flex min-h-tap items-center gap-1 text-sm font-semibold text-primary-dark">
        <ChevronLeft aria-hidden className="size-4" />
        {t("back")}
      </Link>
      <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
      <p className="mt-1 max-w-2xl text-muted">{t("lead")}</p>

      <section aria-labelledby="pratonton" className="mt-6 rounded-card bg-surface p-5">
        <h2 id="pratonton" className="text-lg font-bold">
          {t("preview")}
        </h2>
        <div className="mt-4 flex flex-wrap items-end gap-8">
          <figure className="text-center">
            <MasjidLogo name={masjid.name} src={logoUrl} className="size-28 text-3xl" />
            <figcaption className="mt-2 text-sm text-muted">{t("circle")}</figcaption>
          </figure>
          <figure className="text-center">
            <MasjidLogo name={masjid.name} src={logoUrl} shape="square" className="size-28 text-3xl" />
            <figcaption className="mt-2 text-sm text-muted">{t("square")}</figcaption>
          </figure>
          <figure className="text-center">
            <MasjidLogo name={masjid.name} src={logoUrl} className="size-12" />
            <figcaption className="mt-2 text-sm text-muted">{t("small")}</figcaption>
          </figure>
        </div>
        {!logoUrl ? <p className="mt-4 text-sm text-muted">{t("noLogo")}</p> : null}
      </section>

      <section aria-labelledby="muat-naik" className="mt-6 rounded-card bg-surface p-5">
        <h2 id="muat-naik" className="text-lg font-bold">
          {t(logoUrl ? "replaceTitle" : "uploadTitle")}
        </h2>
        <LogoForms hasLogo={!!logoUrl} />
      </section>
    </>
  );
}
