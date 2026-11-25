"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import type { Role } from "@/lib/permissions";
import { allowedItems, isActive, moreItems, tabItems } from "./nav";

export function BottomTabs({ role }: { role: Role }) {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const inMore = moreItems.some(({ href }) => isActive(pathname, href));

  return (
    <nav
      aria-label={t("label")}
      className="fixed inset-x-0 bottom-0 border-t border-rule bg-surface pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <ul className="grid auto-cols-fr grid-flow-col">
        {allowedItems(tabItems, role).map(({ key, href, icon: Icon }) => {
          const active = isActive(pathname, href) || (key === "lagi" && inMore);
          return (
            <li key={key}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-tap flex-col items-center justify-center gap-1 py-2 text-xs ${
                  active ? "font-bold text-primary" : "font-medium text-muted"
                }`}
              >
                <Icon aria-hidden className="size-6" />
                {t(key)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
