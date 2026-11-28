import Link from "next/link";
import { Download, Lock, Settings2, UserPlus } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { RenewButton } from "@/components/khairat/forms";
import { StatusBadge } from "@/components/khairat/StatusBadge";
import { Figure } from "@/components/kewangan/bits";
import { Notice } from "@/components/ui/forms";
import { todayInMalaysia } from "@/lib/cashbook";
import { formatDay } from "@/lib/dates";
import { dueSen, earlierArrears, owedSen, statusOf, STATUSES, summarise, type KhairatStatus } from "@/lib/khairat";
import { formatSen } from "@/lib/money";
import { can } from "@/lib/permissions";
import { planHasFeature } from "@/lib/plan-limits";
import { requireMember } from "@/lib/session";
import { loadFunds } from "../kewangan/data";
import { loadMemberships, loadPlans } from "./data";

const pick = (value: string | string[] | undefined) => (typeof value === "string" ? value : "");

export default async function KhairatPage({ searchParams }: PageProps<"/khairat">) {
  const { role, masjid } = await requireMember("khairat.view");
  const [t, locale, params] = await Promise.all([getTranslations("khairat"), getLocale(), searchParams]);

  if (!planHasFeature(masjid.plan, "khairat")) {
    return (
      <>
        <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
        <section className="mt-5 max-w-2xl rounded-card bg-surface p-6" data-testid="khairat-naik-taraf">
          <h2 className="flex items-center gap-2 text-lg font-bold">
            <Lock aria-hidden className="size-5 text-gold" />
            {t("upgradeTitle")}
          </h2>
          <p className="mt-2 text-muted">{t("upgradeBody")}</p>
          <p className="mt-2 text-muted">{can(role, "plan.view") ? t("upgradeHowPengerusi") : t("upgradeHowOthers")}</p>
        </section>
      </>
    );
  }

  const today = todayInMalaysia();
  const thisYear = Number(today.slice(0, 4));
  const [plans, memberships, funds] = await Promise.all([loadPlans(), loadMemberships(), loadFunds()]);
  const canSetup = can(role, "khairat.setup");
  const canRecord = can(role, "khairat.record");

  if (plans.length === 0) {
    return (
      <>
        <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
        <div className="mt-5 max-w-2xl rounded-card bg-surface p-6">
          <p className="text-muted">{t("noSetup")}</p>
          {canSetup ? (
            <Link
              href={`/khairat/tetapan?tahun=${thisYear}`}
              className="mt-3 inline-flex min-h-tap items-center gap-2 rounded-chip bg-primary px-4 font-semibold text-surface"
            >
              <Settings2 aria-hidden className="size-4" />
              {t("setUpYear", { year: thisYear })}
            </Link>
          ) : (
            <p className="mt-2 text-sm text-muted">{t("noSetupOthers")}</p>
          )}
        </div>
      </>
    );
  }

  const requested = Number(pick(params.tahun));
  const plan = plans.find((item) => item.year === requested) ?? plans.find((item) => item.year === thisYear) ?? plans[0];
  const year = plan.year;
  const fundName = funds.find((fund) => fund.id === plan.fund_id)?.name ?? "—";
  const hasLastYear = plans.some((item) => item.year === year - 1);

  const yearRows = memberships.filter((row) => row.year === year);
  const summary = summarise(yearRows, today);
  const earlier = earlierArrears(memberships, year, today);

  const status = STATUSES.includes(pick(params.status) as KhairatStatus) ? (pick(params.status) as KhairatStatus) : "";
  const q = pick(params.cari).trim().slice(0, 80);
  const rows = yearRows.filter(
    (row) => (!status || statusOf(row, today) === status) && (!q || row.head_name.toLowerCase().includes(q.toLowerCase())),
  );
  const query = (changes: Record<string, string>) =>
    new URLSearchParams(Object.entries({ tahun: String(year), status, cari: q, ...changes }).filter(([, value]) => value)).toString();

  const enrolled = pick(params.didaftar);

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
          <p className="mt-1 text-muted">
            {t("setupLine", {
              fee: formatSen(plan.fee_sen),
              coverage: t(`per.${plan.coverage}`),
              date: formatDay(plan.pay_by, locale),
              fund: fundName,
            })}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canSetup ? (
            <Link
              href={`/khairat/tetapan?tahun=${year}`}
              className="inline-flex min-h-tap items-center gap-2 rounded-chip border border-border bg-surface px-4 font-semibold text-primary-dark"
            >
              <Settings2 aria-hidden className="size-4" />
              {t("setup")}
            </Link>
          ) : null}
          {canRecord ? (
            <Link
              href={`/khairat/daftar?tahun=${year}`}
              className="inline-flex min-h-tap items-center gap-2 rounded-chip bg-primary px-4 font-semibold text-surface"
            >
              <UserPlus aria-hidden className="size-4" />
              {t("enrol")}
            </Link>
          ) : null}
        </div>
      </div>

      {pick(params.tetapan) === "ok" ? (
        <div className="mt-4">
          <Notice tone="success">{t("setupSaved", { year })}</Notice>
        </div>
      ) : null}
      {enrolled ? (
        <div className="mt-4">
          <Notice tone="success">{t("enrolled", { count: Number(enrolled) || 0 })}</Notice>
        </div>
      ) : null}

      <nav aria-label={t("years")} className="mt-5 flex flex-wrap gap-2">
        {plans.map((item) => (
          <Link
            key={item.id}
            href={`/khairat?tahun=${item.year}`}
            aria-current={item.year === year ? "page" : undefined}
            className={`inline-flex min-h-tap items-center rounded-chip px-4 font-semibold ${
              item.year === year ? "bg-primary text-surface" : "border border-border bg-surface text-primary-dark"
            }`}
          >
            {item.year}
          </Link>
        ))}
        {canSetup && !plans.some((item) => item.year === thisYear + 1) ? (
          <Link
            href={`/khairat/tetapan?tahun=${thisYear + 1}`}
            className="inline-flex min-h-tap items-center px-2 text-sm font-semibold text-primary-dark underline underline-offset-4"
          >
            {t("setUpYear", { year: thisYear + 1 })}
          </Link>
        ) : null}
      </nav>

      <section aria-label={t("summary")} className="mt-3 grid grid-cols-2 gap-4 rounded-card bg-surface p-4 sm:grid-cols-3 lg:grid-cols-5" data-testid="khairat-ringkasan">
        <div>
          <p className="text-sm text-muted">{t("members")}</p>
          <p className="mt-0.5 text-lg font-bold tabular-nums">{summary.members}</p>
        </div>
        <div>
          <p className="text-sm text-muted">{t("statuses.aktif")}</p>
          <p className="mt-0.5 text-lg font-bold tabular-nums">{summary.aktif}</p>
        </div>
        <div>
          <p className="text-sm text-muted">{t("statuses.tunggakan")}</p>
          <p className="mt-0.5 text-lg font-bold tabular-nums">{summary.tunggakan}</p>
        </div>
        <Figure label={t("collected")} sen={summary.paid_sen} />
        <Figure label={t("arrearsTotal")} sen={summary.arrears_sen} emphasis />
      </section>

      {canRecord && hasLastYear ? (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <RenewButton year={year} />
          <p className="text-sm text-muted">{t("renewHint")}</p>
        </div>
      ) : null}

      <form className="mt-5 grid gap-2 rounded-card bg-surface p-4 sm:grid-cols-[1fr_1fr_auto]">
        <input type="hidden" name="tahun" value={year} />
        <label className="block text-sm">
          <span className="font-semibold">{t("search")}</span>
          <input name="cari" defaultValue={q} autoComplete="off" className="mt-1 block min-h-tap w-full rounded-chip border border-border bg-surface px-3" />
        </label>
        <label className="block text-sm">
          <span className="font-semibold">{t("status")}</span>
          <select name="status" defaultValue={status} className="mt-1 block min-h-tap w-full rounded-chip border border-border bg-surface px-3">
            <option value="">{t("allStatuses")}</option>
            {STATUSES.map((item) => (
              <option key={item} value={item}>
                {t(`statuses.${item}`)}
              </option>
            ))}
          </select>
        </label>
        <div className="flex items-end gap-2">
          <button type="submit" className="min-h-tap rounded-chip bg-primary px-4 font-semibold text-surface">
            {t("filter")}
          </button>
          {status || q ? (
            <Link href={`/khairat?tahun=${year}`} className="inline-flex min-h-tap items-center px-2 text-sm font-semibold text-primary-dark underline underline-offset-4">
              {t("clear")}
            </Link>
          ) : null}
        </div>
      </form>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-bold">{t("count", { count: rows.length })}</h2>
        {rows.length > 0 ? (
          <a
            href={`/khairat/eksport?${query({})}`}
            download
            className="inline-flex min-h-tap items-center gap-2 text-sm font-semibold text-primary-dark underline underline-offset-4"
          >
            <Download aria-hidden className="size-4" />
            {t("export")}
          </a>
        ) : null}
      </div>

      {rows.length === 0 ? (
        <p className="mt-3 rounded-card bg-surface p-6 text-muted">{yearRows.length === 0 ? t("emptyYear") : t("emptyFiltered")}</p>
      ) : (
        <ul className="mt-3 divide-y divide-rule rounded-card bg-surface" data-testid="senarai-khairat">
          {rows.map((row) => {
            const rowStatus = statusOf(row, today);
            const before = earlier.get(row.household_id) ?? 0;
            return (
              <li key={row.id}>
                <Link href={`/khairat/${row.id}`} className="flex min-h-tap items-start gap-3 px-4 py-3 hover:bg-background" data-testid="khairat-baris">
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold">{row.head_name}</span>
                    <span className="mt-0.5 flex flex-wrap items-center gap-2">
                      <StatusBadge status={rowStatus} />
                      <span className="text-sm text-muted">
                        {[
                          t("paidOf", { paid: formatSen(row.paid_sen), due: formatSen(dueSen(row)) }),
                          plan.coverage === "person" ? t("people", { count: row.people }) : null,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </span>
                    {before > 0 ? <span className="mt-0.5 block text-sm text-warn-ink">{t("earlierArrears", { amount: formatSen(before) })}</span> : null}
                  </span>
                  <span className="shrink-0 text-right">
                    {rowStatus !== "tamat" && owedSen(row) > 0 ? (
                      <>
                        <span className="block text-xs text-muted">{t("owed")}</span>
                        <span className={`font-semibold tabular-nums ${rowStatus === "tunggakan" ? "text-warn-ink" : ""}`}>{formatSen(owedSen(row))}</span>
                      </>
                    ) : null}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
