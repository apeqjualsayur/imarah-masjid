import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { getTranslations } from "next-intl/server";

export default async function TiadaAksesPage() {
  const t = await getTranslations("forbidden");

  return (
    <div className="rounded-card bg-surface p-6">
      <ShieldAlert aria-hidden className="size-8 text-warn-ink" />
      <h1 className="mt-3 text-2xl font-bold tracking-tight">{t("title")}</h1>
      <p className="mt-2 text-muted">{t("body")}</p>
      <Link
        href="/"
        className="mt-5 inline-flex min-h-tap items-center rounded-chip bg-primary px-5 font-semibold text-surface"
      >
        {t("home")}
      </Link>
    </div>
  );
}
