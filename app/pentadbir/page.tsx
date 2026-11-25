import { LogOut } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { formatDate } from "@/lib/dates";
import { requirePlatformAdmin } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { adminSignOut } from "./actions";
import { PlanForm } from "./plan-form";

type AdminMasjid = {
  id: string;
  name: string;
  state: string | null;
  plan: string;
  user_count: number;
  created_at: string;
};

export default async function PentadbirPage() {
  const user = await requirePlatformAdmin();
  const t = await getTranslations("admin");
  const locale = await getLocale();

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_list_masjids");
  const masjids = (data ?? []) as AdminMasjid[];

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("masjidsTitle")}</h1>
          <p className="mt-1 text-sm text-muted">{t("signedInAs", { email: user.email ?? "" })}</p>
        </div>
        <form action={adminSignOut}>
          <button
            type="submit"
            className="flex min-h-tap items-center gap-2 rounded-chip px-3 text-sm font-semibold text-primary-dark hover:bg-tint"
          >
            <LogOut aria-hidden className="size-5" />
            {t("signOut")}
          </button>
        </form>
      </div>
      <p className="mt-3 rounded-chip bg-gold-tint px-4 py-3 text-sm">{t("loggedNotice")}</p>

      {error ? (
        <p role="alert" className="mt-5 rounded-chip bg-warn-bg px-4 py-3 text-warn-ink">
          {t("loadFailed")}
        </p>
      ) : (
        <ul className="mt-5 divide-y divide-rule rounded-card bg-surface">
          {masjids.map((masjid) => (
            <li key={masjid.id} className="flex flex-wrap items-center gap-x-6 gap-y-3 px-4 py-4">
              <div className="min-w-0 flex-1 basis-64">
                <p className="font-semibold">{masjid.name}</p>
                <p className="text-sm text-muted">
                  {[masjid.state, t("userCount", { count: masjid.user_count }), formatDate(masjid.created_at, locale)]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
              <PlanForm masjidId={masjid.id} masjidName={masjid.name} plan={masjid.plan} />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
