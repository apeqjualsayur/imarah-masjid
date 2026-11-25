import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Notice } from "@/components/ui/forms";
import { getMembership, getUser, isPlatformAdmin } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { SignOutButton } from "@/components/SignOutButton";
import { CreateMasjidForm } from "./form";

export default async function MulaPage() {
  const user = await getUser();
  if (!user) redirect("/log-masuk");
  if (isPlatformAdmin(user)) redirect("/pentadbir");
  if (await getMembership()) redirect("/");

  const t = await getTranslations("onboarding");

  // A removed member cannot see their own old membership through RLS, so this
  // one check uses the server key. Only a yes or no leaves the server.
  const { count } = await createAdminClient()
    .from("memberships")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);

  if (count) {
    return (
      <>
        <h1 className="text-2xl font-bold tracking-tight">{t("removedTitle")}</h1>
        <div className="mt-5">
          <Notice tone="error">{t("removedBody")}</Notice>
        </div>
        <div className="mt-6">
          <SignOutButton />
        </div>
      </>
    );
  }

  return (
    <>
      <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
      <p className="mt-1 text-muted">{t("lead")}</p>
      <CreateMasjidForm />
      <div className="mt-8 border-t border-rule pt-4 text-sm text-muted">
        <p>{t("invitedHint")}</p>
        <div className="mt-3">
          <SignOutButton />
        </div>
      </div>
    </>
  );
}
