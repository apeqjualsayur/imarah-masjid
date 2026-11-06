"use client";

import { useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { setLocale } from "@/i18n/actions";
import { locales } from "@/i18n/config";

export function LanguageToggle() {
  const t = useTranslations("language");
  const current = useLocale();
  const [pending, startTransition] = useTransition();

  return (
    <div role="group" aria-label={t("label")} className="flex shrink-0 rounded-pill bg-surface p-0.5">
      {locales.map((locale) => {
        const active = locale === current;
        return (
          <button
            key={locale}
            type="button"
            aria-label={t(`${locale}Full`)}
            aria-pressed={active}
            disabled={pending}
            onClick={() => startTransition(() => setLocale(locale))}
            className={`min-h-tap min-w-tap rounded-pill px-2 text-xs ${
              active ? "bg-tint font-bold text-primary-dark" : "font-medium text-muted"
            }`}
          >
            {t(locale)}
          </button>
        );
      })}
    </div>
  );
}
