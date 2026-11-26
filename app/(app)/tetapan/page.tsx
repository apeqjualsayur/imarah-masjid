import Link from "next/link";
import { ChevronRight, Image as ImageIcon, KeyRound, Users, Wallet } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { SignOutButton } from "@/components/SignOutButton";
import { can } from "@/lib/permissions";
import { displayName, requireMember } from "@/lib/session";

export default async function TetapanPage() {
  const { user, role } = await requireMember();
  const t = await getTranslations("settings");
  const roles = await getTranslations("roles");

  return (
    <>
      <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>

      <section aria-labelledby="akaun" className="mt-5 rounded-card bg-surface p-5">
        <h2 id="akaun" className="text-lg font-bold">
          {t("account")}
        </h2>
        <dl className="mt-3 grid gap-x-6 gap-y-2 sm:grid-cols-[auto_1fr]">
          <dt className="text-sm text-muted">{t("name")}</dt>
          <dd className="font-medium">{displayName(user)}</dd>
          <dt className="text-sm text-muted">{t("email")}</dt>
          <dd className="font-medium break-all">{user.email}</dd>
          <dt className="text-sm text-muted">{t("role")}</dt>
          <dd className="font-medium">{roles(role)}</dd>
        </dl>
      </section>

      <ul className="mt-5 divide-y divide-rule rounded-card bg-surface">
        {can(role, "users.manage") ? (
          <li>
            <Link href="/tetapan/pengguna" className="flex min-h-tap items-center gap-3 px-4 py-3">
              <Users aria-hidden className="size-5 text-primary" />
              <span className="flex-1">
                <span className="block font-medium">{t("users")}</span>
                <span className="block text-sm text-muted">{t("usersLead")}</span>
              </span>
              <ChevronRight aria-hidden className="size-5 text-muted" />
            </Link>
          </li>
        ) : null}
        {can(role, "funds.manage") ? (
          <li>
            <Link href="/tetapan/dana" className="flex min-h-tap items-center gap-3 px-4 py-3">
              <Wallet aria-hidden className="size-5 text-primary" />
              <span className="flex-1">
                <span className="block font-medium">{t("funds")}</span>
                <span className="block text-sm text-muted">{t("fundsLead")}</span>
              </span>
              <ChevronRight aria-hidden className="size-5 text-muted" />
            </Link>
          </li>
        ) : null}
        {can(role, "settings.manage") ? (
          <li>
            <Link href="/tetapan/logo" className="flex min-h-tap items-center gap-3 px-4 py-3">
              <ImageIcon aria-hidden className="size-5 text-primary" />
              <span className="flex-1">
                <span className="block font-medium">{t("logo")}</span>
                <span className="block text-sm text-muted">{t("logoLead")}</span>
              </span>
              <ChevronRight aria-hidden className="size-5 text-muted" />
            </Link>
          </li>
        ) : null}
        <li>
          <Link href="/tetapkan-kata-laluan" className="flex min-h-tap items-center gap-3 px-4 py-3 font-medium">
            <KeyRound aria-hidden className="size-5 text-primary" />
            <span className="flex-1">{t("changePassword")}</span>
            <ChevronRight aria-hidden className="size-5 text-muted" />
          </Link>
        </li>
      </ul>

      <div className="mt-5">
        <SignOutButton />
      </div>
    </>
  );
}
