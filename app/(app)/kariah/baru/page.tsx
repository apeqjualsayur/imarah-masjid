import { getTranslations } from "next-intl/server";
import { BackLink } from "@/components/BackLink";
import { HouseholdForm } from "@/components/kariah/forms";
import { requireMember } from "@/lib/session";

export default async function NewHouseholdPage() {
  await requireMember("kariah.edit");
  const t = await getTranslations("kariah");

  return (
    <>
      <BackLink href="/kariah" label={t("title")} />
      <h1 className="text-3xl font-bold tracking-tight">{t("addTitle")}</h1>
      <div className="max-w-2xl">
        <HouseholdForm />
      </div>
    </>
  );
}
