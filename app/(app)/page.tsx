import Link from "next/link";
import { ArrowDownLeft, ArrowUpRight, HandCoins, Plus } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { Badge, SignedAmount } from "@/components/kewangan/bits";
import { currentMonth, todayInMalaysia } from "@/lib/cashbook";
import { formatDay, formatMonth } from "@/lib/dates";
import { formatSen } from "@/lib/money";
import { summarise, type KhairatSummary } from "@/lib/khairat";
import { can } from "@/lib/permissions";
import { planHasFeature } from "@/lib/plan-limits";
import { requireMember } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { loadMemberships, loadPlans } from "./khairat/data";
import { loadOpenCollections } from "./kewangan/kutipan/data";
import {
  loadCategories,
  loadFunds,
  loadFundSummary,
  loadMasjidTotals,
  TRANSACTION_COLUMNS,
  type Transaction,
} from "./kewangan/data";

/** "RM" small, the figure large, as on the designs. */
function BigAmount({ sen, className = "" }: { sen: number; className?: string }) {
  const [, figure] = formatSen(sen).split("RM ");
  return (
    <span className={`font-bold tabular-nums tracking-tight ${className}`}>
      <span className="mr-1 text-[0.5em] font-semibold">{sen < 0 ? "-RM" : "RM"}</span>
      {figure}
    </span>
  );
}

export default async function UtamaPage() {
  const { user, role, masjid } = await requireMember("dashboard.view");
  const t = await getTranslations("utama");
  const k = await getTranslations("kewangan");
  const locale = await getLocale();
  const month = currentMonth();

  const showFunds = can(role, "dashboard.balances");
  const showLedger = can(role, "finance.view");

  const [totals, funds, recent, categories] = await Promise.all([
    loadMasjidTotals(month),
    showFunds ? loadFundSummary(null, null) : Promise.resolve([]),
    showLedger
      ? createClient().then((supabase) =>
          supabase.from("transactions").select(TRANSACTION_COLUMNS).order("date", { ascending: false }).order("created_at", { ascending: false }).limit(5),
        )
      : Promise.resolve(null),
    showLedger ? loadCategories() : Promise.resolve([]),
  ]);

  // Counts this person can act on: confirm someone else's, or recount after a difference.
  const mayConfirm = can(role, "collections.confirm");
  const mayCount = can(role, "collections.count");
  const actions =
    mayConfirm || mayCount
      ? (await loadOpenCollections()).filter((collection) =>
          collection.status === "counted" ? mayConfirm && collection.counted_by !== user.id : mayCount,
        )
      : [];
  const allFundNames = showFunds ? funds : await loadFunds();

  // Khairat this year (or the latest year set up), for those who may see it.
  const today = todayInMalaysia();
  let khairat: { year: number; summary: KhairatSummary } | null = null;
  if (can(role, "khairat.view") && planHasFeature(masjid.plan, "khairat")) {
    const [plans, memberships] = await Promise.all([loadPlans(), loadMemberships()]);
    const plan = plans.find((item) => item.year <= Number(today.slice(0, 4))) ?? plans.at(-1);
    if (plan) khairat = { year: plan.year, summary: summarise(memberships.filter((row) => row.year === plan.year), today) };
  }

  const openFunds = funds.filter((fund) => !fund.archived_at || fund.closing_sen !== 0);
  const recentRows = (recent?.data ?? []) as Transaction[];
  const fundName = new Map(funds.map((fund) => [fund.id, fund.name]));
  const categoryName = new Map(categories.map((category) => [category.id, category.name]));

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
          <p className="mt-1 text-muted">{formatMonth(month, locale)}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {mayCount ? (
            <Link
              href="/kewangan/kutipan/baru"
              className="inline-flex min-h-tap items-center gap-2 rounded-chip bg-primary px-4 font-semibold text-surface"
            >
              <HandCoins aria-hidden className="size-4" />
              {t("recordCollection")}
            </Link>
          ) : null}
          {can(role, "transactions.record") ? (
            <Link
              href="/kewangan/baru"
              className="inline-flex min-h-tap items-center gap-2 rounded-chip border border-border bg-surface px-4 font-semibold text-primary-dark"
            >
              <Plus aria-hidden className="size-4" />
              {k("record")}
            </Link>
          ) : null}
        </div>
      </div>

      {actions.length > 0 ? (
        <section aria-labelledby="tindakan" className="mt-5">
          <h2 id="tindakan" className="text-lg font-bold">
            {t("actions", { count: actions.length })}
          </h2>
          <ul className="mt-3 space-y-2" data-testid="perlu-tindakan">
            {actions.map((collection) => (
              <li key={collection.id} className="flex flex-wrap items-center gap-3 rounded-card bg-surface p-4">
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{t("collectionOn", { date: formatDay(collection.date, locale) })}</span>
                  <span className="block text-sm text-muted">
                    {allFundNames.find((fund) => fund.id === collection.fund_id)?.name ?? "—"} ·{" "}
                    {collection.status === "counted" ? t("awaitingConfirm") : t("awaitingRecount")}
                  </span>
                </span>
                <Link
                  href={`/kewangan/kutipan/${collection.id}`}
                  className="inline-flex min-h-tap items-center rounded-chip bg-primary px-4 font-semibold text-surface"
                >
                  {collection.status === "counted" ? t("confirmAction") : t("recountAction")}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section aria-labelledby="jumlah" className="mt-5 rounded-hero bg-primary p-6 text-surface">
        <h2 id="jumlah" className="text-sm font-medium opacity-90">
          {t("total")}
        </h2>
        <p className="mt-1 text-4xl sm:text-5xl" data-testid="jumlah-semua-dana">
          {totals ? <BigAmount sen={totals.total_sen} /> : "—"}
        </p>
        <p className="mt-2 text-sm opacity-90">{t("totalNote")}</p>
      </section>

      <section aria-label={t("thisMonth")} className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-card bg-surface p-4">
          <p className="flex items-center gap-1.5 text-sm text-muted">
            <ArrowDownLeft aria-hidden className="size-4 text-primary-dark" />
            {t("monthIn")}
          </p>
          <p className="mt-1 text-xl font-bold tabular-nums" data-testid="masuk-bulan-ini">
            {formatSen(totals?.month_in_sen ?? 0)}
          </p>
        </div>
        <div className="rounded-card bg-surface p-4">
          <p className="flex items-center gap-1.5 text-sm text-muted">
            <ArrowUpRight aria-hidden className="size-4 text-warn-ink" />
            {t("monthOut")}
          </p>
          <p className="mt-1 text-xl font-bold tabular-nums" data-testid="keluar-bulan-ini">
            {formatSen(totals?.month_out_sen ?? 0)}
          </p>
        </div>
      </section>

      {showFunds ? (
        <section aria-labelledby="dana" className="mt-6">
          <h2 id="dana" className="text-lg font-bold">
            {t("funds")}
          </h2>
          {openFunds.length === 0 ? (
            <p className="mt-3 rounded-card bg-surface p-5 text-muted">{t("noFunds")}</p>
          ) : (
            <ul className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {openFunds.map((fund) => (
                <li key={fund.id} className="rounded-card bg-surface p-4" data-testid="kad-dana">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold">{fund.name}</h3>
                    {fund.restricted ? <Badge tone="gold">{k("restricted")}</Badge> : null}
                  </div>
                  <p className="mt-2 text-2xl">
                    <BigAmount sen={fund.closing_sen} />
                  </p>
                  <Link
                    href={`/kewangan?dana=${fund.id}`}
                    className="mt-2 inline-flex min-h-tap items-center text-sm font-semibold text-primary-dark underline underline-offset-4"
                  >
                    {t("openLedger")}
                    <span className="sr-only">: {fund.name}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : (
        <p className="mt-6 rounded-card bg-surface p-5 text-sm text-muted">{t("totalsOnly")}</p>
      )}

      {khairat ? (
        <section aria-labelledby="khairat" className="mt-6 rounded-card bg-surface p-5" data-testid="kad-khairat">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id="khairat" className="text-lg font-bold">
              {t("khairatTitle", { year: khairat.year })}
            </h2>
            <Link
              href={`/khairat?tahun=${khairat.year}&status=tunggakan`}
              className="inline-flex min-h-tap items-center text-sm font-semibold text-primary-dark underline underline-offset-4"
            >
              {t("khairatArrearsList")}
            </Link>
          </div>
          <dl className="mt-2 grid grid-cols-3 gap-3">
            <div>
              <dt className="text-sm text-muted">{t("khairatMembers")}</dt>
              <dd className="text-xl font-bold tabular-nums">{khairat.summary.members}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted">{t("khairatInArrears")}</dt>
              <dd className="text-xl font-bold tabular-nums">{khairat.summary.tunggakan}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted">{t("khairatArrears")}</dt>
              <dd className="text-xl font-bold tabular-nums text-warn-ink">{formatSen(khairat.summary.arrears_sen)}</dd>
            </div>
          </dl>
        </section>
      ) : null}

      {showLedger ? (
        <section aria-labelledby="terkini" className="mt-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id="terkini" className="text-lg font-bold">
              {t("recent")}
            </h2>
            <Link href="/kewangan" className="text-sm font-semibold text-primary-dark underline underline-offset-4">
              {t("fullLedger")}
            </Link>
          </div>
          {recentRows.length === 0 ? (
            <p className="mt-3 rounded-card bg-surface p-5 text-muted">{t("noEntries")}</p>
          ) : (
            <ul className="mt-3 divide-y divide-rule rounded-card bg-surface">
              {recentRows.map((row) => (
                <li key={row.id}>
                  <Link href={`/kewangan/${row.id}`} className="flex min-h-tap items-center gap-3 px-4 py-3 hover:bg-background">
                    <span className="w-14 shrink-0 text-sm text-muted">{formatDay(row.date, locale, false)}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">
                        {(row.category_id && categoryName.get(row.category_id)) || k("noCategory")}
                      </span>
                      <span className="block truncate text-sm text-muted">
                        {[fundName.get(row.fund_id), row.reverses_id ? k("reversal") : null, row.ref_no].filter(Boolean).join(" · ")}
                      </span>
                    </span>
                    <SignedAmount sen={row.amount_sen} direction={row.direction} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}
    </>
  );
}
