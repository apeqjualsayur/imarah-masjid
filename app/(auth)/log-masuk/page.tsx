import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Notice } from "@/components/ui/forms";
import { getUser } from "@/lib/session";
import { safeNext } from "@/lib/safe-next";
import { MagicLinkForm, PasswordForm } from "./forms";

export default async function LogMasukPage({ searchParams }: PageProps<"/log-masuk">) {
  const { pautan, seterusnya } = await searchParams;
  const next = safeNext(seterusnya);
  if (await getUser()) redirect(next);

  const t = await getTranslations("auth");
  const errors = await getTranslations("errors");

  return (
    <>
      <h1 className="text-2xl font-bold tracking-tight">{t("signInTitle")}</h1>
      <p className="mt-1 text-muted">{t("signInLead")}</p>

      {pautan === "rosak" ? (
        <div className="mt-5">
          <Notice tone="error">{errors("link_expired")}</Notice>
        </div>
      ) : null}

      <PasswordForm next={next} />

      <p className="mt-4 text-sm">
        <Link href="/lupa-kata-laluan" className="font-semibold text-primary-dark underline underline-offset-4">
          {t("forgot")}
        </Link>
      </p>

      <div className="my-6 flex items-center gap-3 text-sm text-muted">
        <span aria-hidden className="h-px flex-1 bg-rule" />
        {t("or")}
        <span aria-hidden className="h-px flex-1 bg-rule" />
      </div>

      <MagicLinkForm />

      <p className="mt-8 text-sm text-muted">
        {t("noAccount")}{" "}
        <Link href="/daftar" className="font-semibold text-primary-dark underline underline-offset-4">
          {t("createAccount")}
        </Link>
      </p>
    </>
  );
}
