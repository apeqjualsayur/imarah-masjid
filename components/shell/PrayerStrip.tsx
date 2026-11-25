"use client";

import { useEffect, useState } from "react";
import { Clock } from "lucide-react";
import { useTranslations } from "next-intl";
import { formatMinutes, pickHighlight, PRAYERS, type PrayerDay, type PrayerKey } from "@/lib/prayer-schedule";

// Syuruk is a time, not a prayer. Left out to match the designs.
const SHOWN: PrayerKey[] = ["subuh", "zohor", "asar", "maghrib", "isyak"];

type Props = { variant: "strip" | "row"; days: PrayerDay[]; serverNow: number };

/**
 * Today's times with the next prayer highlighted. Starts from the server's
 * clock so the first paint matches, then follows the device every 30 seconds.
 * Hides itself if the right day is not in the data.
 */
export function PrayerStrip({ variant, days, serverNow }: Props) {
  const t = useTranslations("prayer");
  const [now, setNow] = useState(serverNow);

  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const timer = setInterval(tick, 30_000);
    return () => clearInterval(timer);
  }, []);

  const highlight = pickHighlight(days, now);
  if (!highlight) return null;

  const items = SHOWN.map((key) => ({
    key,
    time: formatMinutes(highlight.day.minutes[PRAYERS.indexOf(key)]),
    next: key === highlight.next,
  }));

  if (variant === "strip") {
    return (
      <div className="flex items-center gap-1 text-xs text-muted" data-testid="prayer-strip">
        <Clock aria-hidden className="mr-2 size-3.5" />
        <ul aria-label={t("label")} className="flex items-center gap-1">
          {items.map(({ key, time, next }) => (
            <li
              key={key}
              aria-current={next ? "time" : undefined}
              className={`rounded-pill px-2.5 py-1 ${next ? "bg-tint font-bold text-primary-dark" : ""}`}
            >
              {t(key)} {time}
              {next ? <span className="sr-only"> ({t("next")})</span> : null}
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <ul aria-label={t("label")} className="mt-3 grid grid-cols-5 gap-1 text-center text-xs text-muted" data-testid="prayer-row">
      {items.map(({ key, time, next }) => (
        <li
          key={key}
          aria-current={next ? "time" : undefined}
          className={`rounded-chip py-1.5 ${next ? "bg-tint font-bold text-primary-dark" : ""}`}
        >
          <span className="block">{t(key)}</span>
          <span className="block">{time}</span>
          {next ? <span className="sr-only">{t("next")}</span> : null}
        </li>
      ))}
    </ul>
  );
}
