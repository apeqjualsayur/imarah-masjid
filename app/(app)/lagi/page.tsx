import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { SignOutButton } from "@/components/SignOutButton";
import { allowedItems, moreItems } from "@/components/shell/nav";
import { requireMember } from "@/lib/session";

export default async function LagiPage() {
  const { role } = await requireMember();
  const t = await getTranslations("nav");

  return (
    <>
      <h1 className="text-3xl font-bold tracking-tight">{t("lagi")}</h1>
      <ul className="mt-5 divide-y divide-rule rounded-card bg-surface">
        {allowedItems(moreItems, role).map(({ key, href, icon: Icon }) => (
          <li key={key}>
            <Link href={href} className="flex min-h-tap items-center gap-3 px-4 py-3 font-medium">
              <Icon aria-hidden className="size-5 text-primary" />
              <span className="flex-1">{t(key)}</span>
              <ChevronRight aria-hidden className="size-5 text-muted" />
            </Link>
          </li>
        ))}
      </ul>
      <div className="mt-5">
        <SignOutButton />
      </div>
    </>
  );
}
