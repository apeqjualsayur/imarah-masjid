import { PlaceholderPage } from "@/components/PlaceholderPage";
import { requireMember } from "@/lib/session";

export default async function KhairatPage() {
  await requireMember("khairat.view");
  return <PlaceholderPage titleKey="khairat" />;
}