import { getTranslations } from "next-intl/server";
import { BackLink } from "@/components/BackLink";
import { requireMember } from "@/lib/session";
import { ImportFlow } from "./flow";

export default async function ImportPage() {
  await requireMember("kariah.edit");
  const t = await getTranslations("kariahImport");

  return (
    <>
      <BackLink href="/kariah" label={t("back")} />
      <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
      <p className="mt-1 max-w-2xl text-muted">{t("lead")}</p>
      <ImportFlow />
    </>
  );
}
