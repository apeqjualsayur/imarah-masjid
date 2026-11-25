import { getTranslations } from "next-intl/server";
import { LanguageToggle } from "@/components/shell/LanguageToggle";

// The platform admin area. Separate from the masjid app: no masjid menu.
export default async function AdminLayout({ children }: LayoutProps<"/pentadbir">) {
  const t = await getTranslations("admin");

  return (
    <div className="min-h-dvh px-5 pt-[calc(env(safe-area-inset-top)+1rem)] pb-10 md:px-9">
      <div className="mx-auto flex max-w-5xl items-center justify-between">
        <div>
          <p className="text-xl font-bold text-primary-dark">{t("brand")}</p>
          <p className="text-xs text-muted">{t("brandLead")}</p>
        </div>
        <LanguageToggle />
      </div>
      <main className="mx-auto mt-8 max-w-5xl">{children}</main>
    </div>
  );
}
