import { getTranslations } from "next-intl/server";
import type { NavKey } from "@/components/shell/nav";

export async function PlaceholderPage({ titleKey }: { titleKey: NavKey }) {
  const nav = await getTranslations("nav");
  const t = await getTranslations("placeholder");

  return (
    <>
      <h1 className="text-3xl font-bold tracking-tight">{nav(titleKey)}</h1>
      <div className="mt-5 rounded-card bg-surface p-6 text-muted">{t("body")}</div>
    </>
  );
}
