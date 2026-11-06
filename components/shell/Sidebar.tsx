"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { FooterCredit } from "./FooterCredit";
import { LogoPlaceholder } from "./LogoPlaceholder";
import { isActive, sidebarItems } from "./nav";

export function Sidebar() {
  const t = useTranslations();
  const pathname = usePathname();

  return (
    <aside className="sticky top-0 hidden h-dvh w-58 shrink-0 flex-col border-r border-rule bg-surface p-4 md:flex">
      <div className="flex items-center gap-3 pt-2 pb-5">
        <LogoPlaceholder className="size-12 shrink-0" />
        <div className="min-w-0">
          <p className="font-bold leading-tight">{t("sample.masjidName")}</p>
          <p className="text-xs text-muted">{t("sample.masjidArea")}</p>
        </div>
      </div>

      <nav aria-label={t("nav.label")}>
        <ul className="space-y-1">
          {sidebarItems.map(({ key, href, icon: Icon }) => {
            const active = isActive(pathname, href);
            return (
              <li key={key}>
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={`flex min-h-tap items-center gap-3 rounded-chip px-3 text-sm ${
                    active ? "bg-tint font-bold text-primary-dark" : "font-medium text-muted hover:bg-background"
                  }`}
                >
                  <Icon aria-hidden className="size-5" />
                  {t(`nav.${key}`)}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="mt-auto pb-2 pl-1">
        <FooterCredit />
      </div>
    </aside>
  );
}
