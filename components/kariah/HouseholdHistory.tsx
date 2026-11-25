import { getLocale, getTranslations } from "next-intl/server";
import { formatDate } from "@/lib/dates";
import { describeChanges } from "@/lib/history";
import { createClient } from "@/lib/supabase/server";

type Entry = {
  at: string;
  action: "INSERT" | "UPDATE" | "DELETE" | "VIEW";
  table_name: string;
  user_name: string | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
};

function timeOf(at: string) {
  return new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kuala_Lumpur", hour: "2-digit", minute: "2-digit" }).format(
    new Date(at),
  );
}

/**
 * Who changed this household and its members, and when. Personal fields show
 * that they changed, never the values: the log does not keep them.
 */
export async function HouseholdHistory({ householdId }: { householdId: string }) {
  const t = await getTranslations("history");
  const locale = await getLocale();
  const supabase = await createClient();
  const { data } = await supabase.rpc("household_history", { p_household_id: householdId });
  const entries = (data ?? []) as Entry[];

  return (
    <section aria-labelledby="sejarah" className="mt-6">
      <h2 id="sejarah" className="text-lg font-bold">
        {t("title")}
      </h2>
      <p className="mt-1 text-sm text-muted">{t("lead")}</p>
      {entries.length === 0 ? (
        <p className="mt-3 rounded-card bg-surface p-5 text-muted">{t("empty")}</p>
      ) : (
        <ol className="mt-3 divide-y divide-rule rounded-card bg-surface" data-testid="history">
          {entries.map((entry, index) => {
            const changes = describeChanges(entry.before, entry.after);
            return (
              <li key={index} className="px-4 py-3">
                <p className="text-sm">
                  <span className="font-semibold">{t(`action.${entry.table_name}.${entry.action}`)}</span>
                  {" · "}
                  {entry.user_name ?? t("system")}
                  {" · "}
                  <span className="text-muted">
                    {formatDate(entry.at, locale)}, {timeOf(entry.at)}
                  </span>
                </p>
                {entry.action === "UPDATE" && changes.length > 0 ? (
                  <ul className="mt-1 space-y-0.5 text-sm text-muted">
                    {changes.map((change) => (
                      <li key={change.field}>
                        {t(`field.${change.field}`)}:{" "}
                        {change.personal
                          ? t("changedHidden")
                          : t("changedFromTo", { from: change.from ?? t("blank"), to: change.to ?? t("blank") })}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
