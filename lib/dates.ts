const MONTHS = {
  ms: ["Jan", "Feb", "Mac", "Apr", "Mei", "Jun", "Jul", "Ogo", "Sep", "Okt", "Nov", "Dis"],
  en: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
} as const;

const FULL_MONTHS = {
  ms: ["Januari", "Februari", "Mac", "April", "Mei", "Jun", "Julai", "Ogos", "September", "Oktober", "November", "Disember"],
  en: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
} as const;

/** "2026-11" -> "November 2026". */
export function formatMonth(month: string, locale: string) {
  const [year, m] = month.split("-").map(Number);
  return `${(locale === "en" ? FULL_MONTHS.en : FULL_MONTHS.ms)[m - 1]} ${year}`;
}

/** "2026-10-29" (a plain date, no time) -> "29 Okt" or "29 Okt 2026". */
export function formatDay(date: string, locale: string, withYear = true) {
  const [year, m, day] = date.split("-").map(Number);
  const months = locale === "en" ? MONTHS.en : MONTHS.ms;
  return withYear ? `${day} ${months[m - 1]} ${year}` : `${day} ${months[m - 1]}`;
}

/** "29 Okt 2026", in Malaysian time. */
export function formatDate(value: string | Date, locale: string) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kuala_Lumpur",
    day: "numeric",
    month: "numeric",
    year: "numeric",
  }).formatToParts(new Date(value));
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  const months = locale === "en" ? MONTHS.en : MONTHS.ms;
  return `${get("day")} ${months[get("month") - 1]} ${get("year")}`;
}

/** "29 Okt 2026, 14:05", in Malaysian time. For audit entries and locks. */
export function formatDateTime(value: string | Date, locale: string) {
  const time = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kuala_Lumpur",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
  return `${formatDate(value, locale)}, ${time}`;
}
