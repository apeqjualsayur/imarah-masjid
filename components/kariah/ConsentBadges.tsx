import { Check, X } from "lucide-react";
import { useTranslations } from "next-intl";

/** WhatsApp and PDPA consent as labelled chips: icon and words, not colour alone. */
export function ConsentBadges({ whatsapp, pdpa }: { whatsapp: boolean; pdpa: boolean }) {
  const t = useTranslations("kariah");

  const chip = (yes: boolean, label: string) => (
    <span
      className={`inline-flex items-center gap-1 rounded-pill px-2.5 py-1 text-xs font-semibold ${
        yes ? "bg-tint text-primary-dark" : "bg-track text-muted"
      }`}
    >
      {yes ? <Check aria-hidden className="size-3" /> : <X aria-hidden className="size-3" />}
      {label}
      <span className="sr-only">: {yes ? t("consentYes") : t("consentNo")}</span>
    </span>
  );

  return (
    <span className="flex flex-wrap gap-1.5">
      {chip(whatsapp, "WhatsApp")}
      {chip(pdpa, "PDPA")}
    </span>
  );
}
