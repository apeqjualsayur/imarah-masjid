import type { ReactNode } from "react";
import { BottomTabs } from "./BottomTabs";
import { FooterCredit } from "./FooterCredit";
import { LanguageToggle } from "./LanguageToggle";
import { MobileHeader } from "./MobileHeader";
import { PrayerStrip } from "./PrayerStrip";
import { Sidebar } from "./Sidebar";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh md:flex">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <MobileHeader />
        <div className="hidden flex-wrap items-center justify-end gap-x-4 gap-y-2 px-9 pt-5 md:flex">
          <PrayerStrip variant="strip" />
          <LanguageToggle />
        </div>
        <main className="flex-1 px-5 pt-4 pb-6 md:px-9 md:pt-6">{children}</main>
        <div className="px-5 pb-28 md:hidden">
          <FooterCredit />
        </div>
      </div>
      <BottomTabs />
    </div>
  );
}
