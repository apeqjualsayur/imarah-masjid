import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { BackLink } from "@/components/BackLink";
import { DeleteButton } from "@/components/kariah/DeleteButton";
import { MemberForm } from "@/components/kariah/forms";
import { requireMember } from "@/lib/session";
import { deleteMember } from "../../../actions";
import { loadHousehold } from "../../data";

export default async function EditMemberPage({ params }: PageProps<"/kariah/[id]/ahli/[memberId]">) {
  await requireMember("kariah.edit");
  const { id, memberId } = await params;
  const household = await loadHousehold(id);
  const member = household.members.find((m) => m.id === memberId);
  if (!member) notFound();
  const t = await getTranslations("kariah");

  return (
    <>
      <BackLink href={`/kariah/${household.id}`} label={household.head_name} />
      <h1 className="text-3xl font-bold tracking-tight">{t("editMemberTitle")}</h1>
      <div className="max-w-2xl">
        <MemberForm householdId={household.id} member={member} />
        <div className="mt-8 border-t border-rule pt-5">
          <DeleteButton
            action={deleteMember.bind(null, household.id, member.id)}
            label={t("deleteMember")}
            confirmText={t("confirmDeleteMember", { name: member.name })}
          />
        </div>
      </div>
    </>
  );
}
