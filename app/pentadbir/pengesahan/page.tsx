import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getUser, isPlatformAdmin } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { CodeForm, EnrolForm } from "./forms";

export default async function PengesahanPage() {
  const user = await getUser();
  if (!user || !isPlatformAdmin(user)) redirect("/pentadbir/log-masuk");

  const supabase = await createClient();
  const { data: level } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (level?.currentLevel === "aal2") redirect("/pentadbir");

  const { data: factors } = await supabase.auth.mfa.listFactors();
  const verified = factors?.totp.find((factor) => factor.status === "verified");
  const t = await getTranslations("admin");

  return (
    <div className="mx-auto max-w-md rounded-panel bg-surface p-6 md:p-8">
      <h1 className="text-2xl font-bold tracking-tight">{t("twoStepTitle")}</h1>
      {verified ? (
        <>
          <p className="mt-1 text-muted">{t("twoStepLead")}</p>
          <CodeForm factorId={verified.id} />
        </>
      ) : (
        <>
          <p className="mt-1 text-muted">{t("enrolLead")}</p>
          <EnrolForm />
        </>
      )}
    </div>
  );
}
