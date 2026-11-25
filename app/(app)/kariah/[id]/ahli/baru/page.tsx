import { getTranslations } from "next-intl/server";
import { BackLink } from "@/components/BackLink";
import { MemberForm } from "@/components/kariah/forms";
import { requireMember } from "@/lib/session";
import { loadHousehold } from "../../data";

export default async function NewMemberPage({ params }: PageProps<"/kariah/[id]/ahli/baru">) {
  await requireMember("kariah.edit");
  const { id } = await params;
  const household = await loadHousehold(id);
  const t = await getTranslations("kariah");

  return (
    <>
      <BackLink href={`/kariah/${household.id}`} label={household.head_name} />
      <h1 className="text-3xl font-bold tracking-tight">{t("addMember")}</h1>
      <div className="max-w-2xl">
        <MemberForm householdId={household.id} />
      </div>
    </>
  );
}
