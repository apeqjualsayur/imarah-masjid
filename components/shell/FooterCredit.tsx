import { useTranslations } from "next-intl";

export function FooterCredit() {
  const t = useTranslations("app");

  return (
    <p className="flex items-center gap-2 text-xs text-muted">
      <span aria-hidden className="size-2 rounded-pill border-2 border-gold" />
      {t("credit")}
    </p>
  );
}
