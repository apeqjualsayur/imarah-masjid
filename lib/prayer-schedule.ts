// Pure prayer-time maths shared by the server and the browser: dates in
// Malaysian time, data checks, which prayer is next and how times are written.
// Where the times come from lives in lib/prayer-times.ts.

export const PRAYERS = ["subuh", "syuruk", "zohor", "asar", "maghrib", "isyak"] as const;
export type PrayerKey = (typeof PRAYERS)[number];

/** One day in a zone. Times are minutes after midnight, Malaysian time, in PRAYERS order. */
export type PrayerDay = { date: string; minutes: number[] };

const MYT_OFFSET_MS = 8 * 60 * 60 * 1000;

export function daysInMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function dateKey(year: number, month: number, day: number) {
  return `${year}-${`${month}`.padStart(2, "0")}-${`${day}`.padStart(2, "0")}`;
}

/** Today's date and the minute of the day in Malaysia. */
export function malaysiaNow(now = Date.now()) {
  const shifted = new Date(now + MYT_OFFSET_MS);
  const year = shifted.getUTCFullYear();
  const month = shifted.getUTCMonth() + 1;
  const day = shifted.getUTCDate();
  return { year, month, day, minute: shifted.getUTCHours() * 60 + shifted.getUTCMinutes(), date: dateKey(year, month, day) };
}

/** Six times, each a whole minute of the day, strictly in order. */
export function isValidDay(day: unknown, expectedDate: string): day is PrayerDay {
  if (!day || typeof day !== "object") return false;
  const { date, minutes } = day as PrayerDay;
  if (date !== expectedDate || !Array.isArray(minutes) || minutes.length !== PRAYERS.length) return false;
  return minutes.every(
    (value, i) => Number.isInteger(value) && value >= 0 && value < 1440 && (i === 0 || value > minutes[i - 1]),
  );
}

/** A whole month, every day present and valid. Anything less is not used. */
export function isValidMonth(days: unknown, year: number, month: number): days is PrayerDay[] {
  if (!Array.isArray(days) || days.length !== daysInMonth(year, month)) return false;
  return days.every((day, i) => isValidDay(day, dateKey(year, month, i + 1)));
}

export type Highlight = { day: PrayerDay; next: PrayerKey };

/**
 * Which day to show and which prayer is next. After Isyak the strip moves to
 * tomorrow with Subuh next. Returns null if the right day is not available.
 */
export function pickHighlight(days: PrayerDay[], now = Date.now()): Highlight | null {
  const { date, minute } = malaysiaNow(now);
  const index = days.findIndex((day) => day.date === date);
  if (index === -1) return null;

  const today = days[index];
  const upcoming = today.minutes.findIndex((value, i) => PRAYERS[i] !== "syuruk" && value > minute);
  if (upcoming !== -1) return { day: today, next: PRAYERS[upcoming] };

  const tomorrow = days[index + 1];
  return tomorrow ? { day: tomorrow, next: "subuh" } : null;
}

/** "5:48", "1:10": 12-hour without am/pm, as on the designs. */
export function formatMinutes(value: number) {
  const hours = Math.floor(value / 60) % 12 || 12;
  return `${hours}:${`${value % 60}`.padStart(2, "0")}`;
}
