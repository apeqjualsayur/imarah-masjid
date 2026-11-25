import { PlaceholderPage } from "@/components/PlaceholderPage";
import { requireMember } from "@/lib/session";

export default async function KariahPage() {
  await requireMember("kariah.view");
  return <PlaceholderPage titleKey="kariah" />;
}