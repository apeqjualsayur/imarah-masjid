import { getTranslations } from "next-intl/server";
import { LanguageToggle } from "@/components/shell/LanguageToggle";

// Sign-in, sign-up, onboarding and invitation pages: no menu, one card.
export default async function AuthLayout({ children }: LayoutProps<"/">) {
  const t = await getTranslations("app");

  return (
    <div className="min-h-dvh px-5 pt-[calc(env(safe-area-inset-top)+1rem)] pb-10">
      <div className="mx-auto flex max-w-md items-center justify-between">
        <div>
          <p className="text-xl font-bold text-primary-dark">{t("name")}</p>
          <p className="text-xs text-muted">{t("tagline")}</p>
        </div>
        <LanguageToggle />
      </div>
      <main className="mx-auto mt-8 max-w-md rounded-panel bg-surface p-6 md:p-8">{children}</main>
    </div>
  );
}
