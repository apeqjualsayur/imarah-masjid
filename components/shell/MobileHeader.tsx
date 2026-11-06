import { useTranslations } from "next-intl";
import { LanguageToggle } from "./LanguageToggle";
import { LogoPlaceholder } from "./LogoPlaceholder";
import { PrayerStrip } from "./PrayerStrip";

export function MobileHeader() {
  const t = useTranslations("sample");

  return (
    <header className="px-5 pt-[calc(env(safe-area-inset-top)+1rem)] md:hidden">
      <div className="flex items-center gap-3">
        <LogoPlaceholder className="size-11 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-bold leading-tight">{t("masjidName")}</p>
          <p className="truncate text-xs text-muted">{t("masjidArea")}</p>
        </div>
        <LanguageToggle />
      </div>
      <PrayerStrip variant="row" />
    </header>
  );
}
