import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Notice } from "@/components/ui/forms";
import { SignOutButton } from "@/components/SignOutButton";
import { getUser } from "@/lib/session";
import { previewInvitation } from "./actions";
import { AcceptSignedInForm, NewAccountForm } from "./forms";

export default async function JemputPage({ params }: PageProps<"/jemput/[token]">) {
  const { token } = await params;
  const t = await getTranslations("invite");
  const roles = await getTranslations("roles");
  const preview = await previewInvitation(token);

  if (!preview || preview.status !== "pending") {
    const status = preview?.status ?? "not_found";
    return (
      <>
        <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
        <div className="mt-5">
          <Notice tone="error">{t(`status.${status}`)}</Notice>
        </div>
        <p className="mt-6 text-sm">
          <Link href="/log-masuk" className="font-semibold text-primary-dark underline underline-offset-4">
            {t("toSignIn")}
          </Link>
        </p>
      </>
    );
  }

  const user = await getUser();
  const role = roles(preview.role);

  return (
    <>
      <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
      <p className="mt-2">{t.rich("lead", { masjid: preview.masjid_name, role, b: (c) => <b>{c}</b> })}</p>
      <p className="mt-1 text-sm text-muted">{t("forEmail", { email: preview.email })}</p>

      {!user ? (
        <>
          <NewAccountForm token={token} />
          <p className="mt-6 text-sm text-muted">
            {t("haveAccount")}{" "}
            <Link
              href={`/log-masuk?seterusnya=/jemput/${token}`}
              className="font-semibold text-primary-dark underline underline-offset-4"
            >
              {t("signInFirst")}
            </Link>
          </p>
        </>
      ) : user.email?.toLowerCase() === preview.email ? (
        <AcceptSignedInForm token={token} />
      ) : (
        <div className="mt-6 space-y-4">
          <Notice tone="error">{t("wrongAccount", { email: user.email ?? "" })}</Notice>
          <SignOutButton />
        </div>
      )}
    </>
  );
}
