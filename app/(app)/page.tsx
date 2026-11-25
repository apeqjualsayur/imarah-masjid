import { PlaceholderPage } from "@/components/PlaceholderPage";
import { requireMember } from "@/lib/session";

export default async function UtamaPage() {
  await requireMember("dashboard.view");
  return <PlaceholderPage titleKey="utama" />;
}