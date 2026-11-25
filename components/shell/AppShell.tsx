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
      <Sidebar masjid={masjid} user={user} signOut={<SignOutButton />} />
      <div className="flex min-w-0 flex-1 flex-col">
        <MobileHeader masjid={masjid} userName={user.name} prayer={strip("row")} />
        <div className="hidden flex-wrap items-center justify-end gap-x-4 gap-y-2 px-9 pt-5 md:flex">
          {strip("strip")}
          <LanguageToggle />
        </div>
        <main className="flex-1 px-5 pt-4 pb-6 md:px-9 md:pt-6">{children}</main>
        <div className="px-5 pb-28 md:hidden">
          <FooterCredit />
        </div>
      </div>
      <BottomTabs role={user.role} />
    </div>
  );
}
