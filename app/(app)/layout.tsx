import { AppShell } from "@/components/shell/AppShell";
import { getPrayerDays } from "@/lib/prayer-times";
import { areaLine, displayName, getLogoUrl, requireMember } from "@/lib/session";

// Everything in this group needs a signed-in member. Each page adds its own
// capability check on top.
export default async function SignedInLayout({ children }: LayoutProps<"/">) {
  const { masjid, role, user } = await requireMember();
  const [logoUrl, prayer] = await Promise.all([getLogoUrl(masjid.logo_path), getPrayerDays(masjid.prayer_zone)]);

  return (
    <AppShell
      masjid={{ name: masjid.name, area: areaLine(masjid), logoUrl }}
      user={{ name: displayName(user), role }}
      prayerDays={prayer?.days ?? null}
      serverNow={prayer?.at ?? 0}
    >
      {children}
    </AppShell>
  );
}
