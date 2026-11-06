export const locales = ["ms", "en"] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "ms";
export const LOCALE_COOKIE = "imarah-locale";

export function isLocale(value: unknown): value is Locale {
  return locales.includes(value as Locale);
}
