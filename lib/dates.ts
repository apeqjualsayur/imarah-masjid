const MONTHS = {
  ms: ["Jan", "Feb", "Mac", "Apr", "Mei", "Jun", "Jul", "Ogo", "Sep", "Okt", "Nov", "Dis"],
  en: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
} as const;

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
