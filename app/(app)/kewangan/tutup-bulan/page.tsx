import Link from "next/link";
import { ChevronRight, Lock, LockOpen } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { BackLink } from "@/components/BackLink";
import { Badge } from "@/components/kewangan/bits";
import { currentMonth } from "@/lib/cashbook";
import { formatDate, formatMonth } from "@/lib/dates";
import { recentMonths } from "@/lib/periods";
import { requireMember } from "@/lib/session";
import { loadMemberNames } from "../data";
import { loadPeriods } from "./data";

/** Recent months with their lock state, and any older locked months. */
export default async function TutupBulanPage() {
  await requireMember("periods.view");
  const [t, k] = await Promise.all([getTranslations("tutupBulan"), getTranslations("kewangan")]);
  const locale = await getLocale();
  const [periods, names] = await Promise.all([loadPeriods(), loadMemberNames()]);
  const current = currentMonth();

  const recent = recentMonths(current, 12);
  const older = [...periods.keys()].filter((month) => !recent.includes(month) && month < current && periods.get(month)?.locked_at).sort().reverse();
  const months = [...recent, ...older];

  return (
    <>
      <BackLink href="/kewangan" label={k("title")} />
      <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
      <p className="mt-1 max-w-2xl text-muted">{t("lead")}</p>

      <ul className="mt-5 max-w-3xl divide-y divide-rule rounded-card bg-surface" data-testid="senarai-bulan">
        {months.map((month) => {
          const period = periods.get(month);
          const locked = !!period?.locked_at;
          return (
            <li key={month}>
              <Link href={`/kewangan/tutup-bulan/${month}`} className="flex min-h-tap items-center gap-3 px-4 py-3" data-testid="bulan-baris">
                {locked ? <Lock aria-hidden className="size-5 text-primary" /> : <LockOpen aria-hidden className="size-5 text-muted" />}
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{formatMonth(month, locale)}</span>
                  <span className="block text-sm text-muted">
                    {locked
                      ? t("lockedBy", { name: names.get(period!.locked_by ?? "") ?? t("someone"), date: formatDate(period!.locked_at!, locale) })
                      : month === current
                        ? t("currentMonth")
                        : period?.unlock_reason
                          ? t("unlockedWith", { reason: period.unlock_reason })
                          : t("notLockedYet")}
                  </span>
                </span>
                {locked ? <Badge tone="teal">{t("locked")}</Badge> : <Badge tone="plain">{t("open")}</Badge>}
                <ChevronRight aria-hidden className="size-5 text-muted" />
              </Link>
            </li>
          );
        })}
      </ul>
    </>
  );
}
