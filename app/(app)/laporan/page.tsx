import { PlaceholderPage } from "@/components/PlaceholderPage";
import { requireMember } from "@/lib/session";

export default async function LaporanPage() {
  await requireMember("reports.prepare");
  return <PlaceholderPage titleKey="laporan" />;
}