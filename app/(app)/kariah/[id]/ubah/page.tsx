import { getTranslations } from "next-intl/server";
import { BackLink } from "@/components/BackLink";
import { HouseholdForm } from "@/components/kariah/forms";
import { requireMember } from "@/lib/session";
import { loadHousehold } from "../data";

export default async function EditHouseholdPage({ params }: PageProps<"/kariah/[id]/ubah">) {
  await requireMember("kariah.edit");
  const { id } = await params;
  const household = await loadHousehold(id);
  const t = await getTranslations("kariah");

  return (
    <>
      <BackLink href={`/kariah/${household.id}`} label={household.head_name} />
      <h1 className="text-3xl font-bold tracking-tight">{t("editTitle")}</h1>
      <div className="max-w-2xl">
        <HouseholdForm household={household} />
      </div>
    </>
  );
}
