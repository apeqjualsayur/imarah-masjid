import { PlaceholderPage } from "@/components/PlaceholderPage";
import { requireMember } from "@/lib/session";

export default async function KewanganPage() {
  await requireMember("finance.view");
  return <PlaceholderPage titleKey="kewangan" />;
}