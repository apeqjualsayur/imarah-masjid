import { Clock } from "lucide-react";
import { useTranslations } from "next-intl";
import { sampleCurrentPrayer, samplePrayerTimes } from "@/lib/sample-prayer-times";

export function PrayerStrip({ variant }: { variant: "strip" | "row" }) {
  const t = useTranslations("prayer");

  if (variant === "strip") {
    return (
      <div className="flex items-center gap-1 text-xs text-muted">
        <Clock aria-hidden className="mr-2 size-3.5" />
        <ul aria-label={t("label")} className="flex items-center gap-1">
          {samplePrayerTimes.map(({ key, time }) => {
            const current = key === sampleCurrentPrayer;
            return (
              <li
                key={key}
                aria-current={current ? "time" : undefined}
                className={`rounded-pill px-2.5 py-1 ${current ? "bg-tint font-bold text-primary-dark" : ""}`}
              >
                {t(key)} {time}
              </li>
            );
          })}
        </ul>
      </div>
    );
  }

  return (
    <ul aria-label={t("label")} className="mt-3 grid grid-cols-5 gap-1 text-center text-xs text-muted">
      {samplePrayerTimes.map(({ key, time }) => {
        const current = key === sampleCurrentPrayer;
        return (
          <li
            key={key}
            aria-current={current ? "time" : undefined}
            className={`rounded-chip py-1.5 ${current ? "bg-tint font-bold text-primary-dark" : ""}`}
          >
            <span className="block">{t(key)}</span>
            <span className="block">{time}</span>
          </li>
        );
      })}
    </ul>
  );
}
