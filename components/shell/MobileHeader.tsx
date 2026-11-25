import { LanguageToggle } from "./LanguageToggle";
import { LogoPlaceholder } from "./LogoPlaceholder";
import { PrayerStrip } from "./PrayerStrip";

export function MobileHeader({ masjidName, masjidArea }: { masjidName: string; masjidArea: string }) {
  return (
    <header className="px-5 pt-[calc(env(safe-area-inset-top)+1rem)] md:hidden">
      <div className="flex items-center gap-3">
        <LogoPlaceholder className="size-11 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-bold leading-tight">{masjidName}</p>
          {masjidArea ? <p className="truncate text-xs text-muted">{masjidArea}</p> : null}
        </div>
        <LanguageToggle />
      </div>
      <PrayerStrip variant="row" />
    </header>
  );
}
