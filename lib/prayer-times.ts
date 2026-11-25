// Where prayer times come from. The only file that knows the source, so it can
// change without touching screens. Runs on the server only.
//
// Order of trust: api.waktusolat.app (JAKIM times, fetched on the server and
// cached per zone) -> bundled year file in data/prayer-times/ -> nothing.
// Times are never guessed: data that fails the checks is treated as missing,
// and with nothing left the strip is hidden.

import { readFile } from "node:fs/promises";
import path from "node:path";
import { dateKey, isValidMonth, malaysiaNow, type PrayerDay } from "./prayer-schedule";

export type PrayerSource = "api" | "fallback";

const API_FIELDS = ["fajr", "syuruk", "dhuhr", "asr", "maghrib", "isha"] as const;

export function apiBase() {
  return process.env.PRAYER_API_URL || "https://api.waktusolat.app";
}

/** Turns one api.waktusolat.app month into PrayerDays. Throws if it cannot be trusted. */
export function parseApiMonth(raw: unknown, zone: string, year: number, month: number): PrayerDay[] {
  const body = raw as { zone?: string; prayers?: Record<string, unknown>[] };
  if (!body || !Array.isArray(body.prayers)) throw new Error("no prayers in response");
  if (body.zone && body.zone.toUpperCase() !== zone) throw new Error(`zone ${body.zone} is not ${zone}`);

  const days = [...body.prayers]
    .sort((a, b) => Number(a.day) - Number(b.day))
    .map((prayer) => {
      const date = dateKey(year, month, Number(prayer.day));
      const minutes = API_FIELDS.map((field) => {
        const seconds = prayer[field];
        if (typeof seconds !== "number" || seconds < 1e9 || seconds >= 1e10) throw new Error(`bad ${field} on ${date}`);
        const local = malaysiaNow(seconds * 1000);
        if (local.date !== date) throw new Error(`${field} on ${date} falls on ${local.date}`);
        return local.minute;
      });
      return { date, minutes };
    });

  if (!isValidMonth(days, year, month)) throw new Error(`month ${year}-${month} for ${zone} failed checks`);
  return days;
}

type Fetcher = (url: string) => Promise<Response>;

const defaultFetcher: Fetcher = (url) =>
  fetch(url, {
    // Next.js keeps each month's answer for 12 hours, per zone.
    next: { revalidate: 43_200, tags: ["prayer-times"] },
    signal: AbortSignal.timeout(5_000),
  } as RequestInit);

export async function fetchApiMonth(zone: string, year: number, month: number, fetcher: Fetcher = defaultFetcher) {
  const url = `${apiBase()}/v2/solat/${encodeURIComponent(zone)}?year=${year}&month=${month}`;
  const response = await fetcher(url);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return parseApiMonth(await response.json(), zone, year, month);
}

/** The bundled file: { year, zones: { SGR01: 12 months of [days][6 minutes] } }. */
export type YearFile = { year: number; zones: Record<string, number[][][]> };

export function fallbackPath(year: number) {
  return path.join(process.cwd(), "data", "prayer-times", `${year}.json`);
}

type YearReader = (year: number) => Promise<YearFile | null>;

const yearFiles = new Map<number, Promise<YearFile | null>>();

const defaultYearReader: YearReader = (year) => {
  if (!yearFiles.has(year)) {
    yearFiles.set(
      year,
      readFile(fallbackPath(year), "utf8")
        .then((text) => JSON.parse(text) as YearFile)
        .catch(() => null),
    );
  }
  return yearFiles.get(year)!;
};

export async function fallbackMonth(zone: string, year: number, month: number, readYear: YearReader = defaultYearReader) {
  const file = await readYear(year);
  const rows = file?.year === year ? file.zones?.[zone]?.[month - 1] : undefined;
  if (!rows) return null;
  const days = rows.map((minutes, i) => ({ date: dateKey(year, month, i + 1), minutes }));
  return isValidMonth(days, year, month) ? days : null;
}

export type Sources = { fetcher?: Fetcher; readYear?: YearReader };

/** One month for a zone: the feed first, then the bundled file, else null. */
export async function getMonth(zone: string, year: number, month: number, sources: Sources = {}) {
  try {
    return { days: await fetchApiMonth(zone, year, month, sources.fetcher), source: "api" as PrayerSource };
  } catch {
    const days = await fallbackMonth(zone, year, month, sources.readYear);
    return days ? { days, source: "fallback" as PrayerSource } : null;
  }
}

/**
 * Today and tomorrow for a zone (tomorrow is needed after Isyak). Returns null
 * when today's times cannot be trusted. Never throws.
 */
export async function getPrayerDays(zone: string | null | undefined, now = Date.now(), sources: Sources = {}) {
  if (!zone || !/^[A-Z]{3}\d{2}$/.test(zone)) return null;
  try {
    const today = malaysiaNow(now);
    const next = malaysiaNow(now + 24 * 60 * 60 * 1000);

    const thisMonth = await getMonth(zone, today.year, today.month, sources);
    const todayRow = thisMonth?.days[today.day - 1];
    if (!thisMonth || !todayRow) return null;

    const nextMonth = next.month === today.month ? thisMonth : await getMonth(zone, next.year, next.month, sources);
    const tomorrowRow = nextMonth?.days[next.day - 1];

    return { days: tomorrowRow ? [todayRow, tomorrowRow] : [todayRow], source: thisMonth.source, at: now };
  } catch {
    return null;
  }
}
