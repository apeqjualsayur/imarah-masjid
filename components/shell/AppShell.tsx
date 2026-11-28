import type { ReactNode } from "react";
import type { Role } from "@/lib/permissions";
import type { PrayerDay } from "@/lib/prayer-schedule";
import { SignOutButton } from "@/components/SignOutButton";
import { BottomTabs } from "./BottomTabs";
import { FooterCredit } from "./FooterCredit";
import { LanguageToggle } from "./LanguageToggle";
import { MobileHeader } from "./MobileHeader";
import { PrayerStrip } from "./PrayerStrip";
import { Sidebar } from "./Sidebar";

export type ShellMasjid = { name: string; area: string; logoUrl: string | null };
export type ShellUser = { name: string; role: Role };

type Props = {
  children: ReactNode;
  masjid: ShellMasjid;
  user: ShellUser;
  /** Today and tomorrow, or null when times cannot be trusted (the strip is hidden). */
  prayerDays: PrayerDay[] | null;
  serverNow: number;
};

export function AppShell({ children, masjid, user, prayerDays, serverNow }: Props) {
  const strip = (variant: "strip" | "row") =>
    prayerDays ? <PrayerStrip variant={variant} days={prayerDays} serverNow={serverNow} /> : null;

  return (
    <div className="min-h-dvh md:flex">
      {/* Printing (the donation poster) shows the page alone, without the app around it. */}
      <div className="contents print:hidden">
        <Sidebar masjid={masjid} user={user} signOut={<SignOutButton />} />
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="contents print:hidden">
          <MobileHeader masjid={masjid} userName={user.name} prayer={strip("row")} />
        </div>
        <div className="hidden flex-wrap items-center justify-end gap-x-4 gap-y-2 px-9 pt-5 md:flex print:hidden">
          {strip("strip")}
          <LanguageToggle />
        </div>
        <main className="flex-1 px-5 pt-4 pb-6 md:px-9 md:pt-6">{children}</main>
        <div className="px-5 pb-28 md:hidden print:hidden">
          <FooterCredit />
        </div>
      </div>
      <div className="contents print:hidden">
        <BottomTabs role={user.role} />
      </div>
    </div>
  );
}
