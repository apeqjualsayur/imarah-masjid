import { AppShell } from "@/components/shell/AppShell";
import { requireMember } from "@/lib/session";

// Everything in this group needs a signed-in member. Each page adds its own
// capability check on top.
export default async function SignedInLayout({ children }: LayoutProps<"/">) {
  const { masjid, role } = await requireMember();

  return (
    <AppShell masjidName={masjid.name} masjidArea={masjid.state ?? ""} role={role}>
      {children}
    </AppShell>
  );
}
