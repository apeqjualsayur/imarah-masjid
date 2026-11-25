"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { MasjidLogo } from "@/components/MasjidLogo";
import { initials } from "@/lib/logo";
import type { ShellMasjid, ShellUser } from "./AppShell";
import { FooterCredit } from "./FooterCredit";
import { allowedItems, isActive, sidebarItems } from "./nav";

type Props = {
  masjid: ShellMasjid;
  user: ShellUser;
  signOut: ReactNode;
};

export function Sidebar({ masjid, user, signOut }: Props) {
  const t = useTranslations();
  const pathname = usePathname();

  return (
    <aside className="sticky top-0 hidden h-dvh w-58 shrink-0 flex-col border-r border-rule bg-surface p-4 md:flex">
      <div className="flex items-center gap-3 pt-2 pb-5">
        <MasjidLogo name={masjid.name} src={masjid.logoUrl} className="size-12" />
        <div className="min-w-0">
          <p className="font-bold leading-tight">{masjid.name}</p>
          {masjid.area ? <p className="text-xs text-muted">{masjid.area}</p> : null}
        </div>
      </div>

      <nav aria-label={t("nav.label")}>
        <ul className="space-y-1">
          {allowedItems(sidebarItems, user.role).map(({ key, href, icon: Icon }) => {
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

      <div className="mt-auto space-y-3 pb-2">
        <div className="pl-1">
          <FooterCredit />
        </div>
        <div className="flex items-center gap-3 pl-1">
          <span
            aria-hidden
            className="flex size-10 shrink-0 items-center justify-center rounded-pill bg-gold-tint text-sm font-bold text-warn-ink"
          >
            {initials(user.name)}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{user.name}</p>
            <p className="text-xs text-muted">{t(`roles.${user.role}`)}</p>
          </div>
        </div>
        {signOut}
      </div>
    </aside>
  );
}
