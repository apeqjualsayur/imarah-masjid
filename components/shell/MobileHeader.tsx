import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { MasjidLogo } from "@/components/MasjidLogo";
import type { ShellMasjid } from "./AppShell";
import { LanguageToggle } from "./LanguageToggle";

type Props = { masjid: ShellMasjid; userName: string; prayer: ReactNode };

export function MobileHeader({ masjid, userName, prayer }: Props) {
  const t = useTranslations("shell");

  return (
    <header className="px-5 pt-[calc(env(safe-area-inset-top)+1rem)] md:hidden">
      <div className="flex items-center gap-3">
        <MasjidLogo name={masjid.name} src={masjid.logoUrl} className="size-11" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs text-muted">{masjid.name}</p>
          <p className="line-clamp-2 text-lg font-bold leading-tight break-words">{t("greeting", { name: userName })}</p>
        </div>
        <LanguageToggle />
      </div>
      {prayer}
    </header>
  );
}
