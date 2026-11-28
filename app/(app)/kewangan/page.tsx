import Link from "next/link";
import { ChevronLeft, ChevronRight, Download, HandCoins, Plus, ReceiptText, Settings2 } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { Badge, Figure, SignedAmount } from "@/components/kewangan/bits";
import { Notice } from "@/components/ui/forms";
import { currentMonth, monthRange, parseMonth, runningBalances, shiftMonth, totals } from "@/lib/cashbook";
import { formatDay, formatMonth } from "@/lib/dates";
import { formatSen } from "@/lib/money";
import { can } from "@/lib/permissions";
import { requireMember } from "@/lib/session";
import { loadCategories, loadFunds, loadFundSummary, loadLedger, type LedgerFilters } from "./data";

const pick = (value: string | string[] | undefined) => (typeof value === "string" ? value : "");

export default async function KewanganPage({ searchParams }: PageProps<"/kewangan">) {
  const { role } = await requireMember("finance.view");
  const t = await getTranslations("kewangan");
  const locale = await getLocale();
  const params = await searchParams;

  const [funds, categories] = await Promise.all([loadFunds(), loadCategories()]);
  const month = parseMonth(params.bulan) ?? currentMonth();
  const filters: LedgerFilters = {
    month,
    fund: funds.some((fund) => fund.id === params.dana) ? pick(params.dana) : "",
    category: categories.some((category) => category.id === params.kategori) ? pick(params.kategori) : "",
    direction: params.jenis === "in" || params.jenis === "out" ? params.jenis : "",
  };

  const { rows, reversed } = await loadLedger(filters);
  const sums = totals(rows);
  const { from, to } = monthRange(month);

  // A running balance only means something for one fund with nothing else filtered out.
  const showBalance = !!filters.fund && !filters.category && !filters.direction;
  const summary = showBalance ? (await loadFundSummary(from, to)).find((fund) => fund.id === filters.fund) : undefined;
  const balances = summary ? runningBalances(rows, summary.opening_sen) : [];

  const fundName = new Map(funds.map((fund) => [fund.id, fund.name]));
  const categoryName = new Map(categories.map((category) => [category.id, category.name]));
  const query = (changes: Record<string, string>) => {
    const next = { bulan: month, dana: filters.fund, kategori: filters.category, jenis: filters.direction, ...changes };
    return new URLSearchParams(Object.entries(next).filter(([, value]) => value)).toString();
  };
  const savedId = pick(params.disimpan);
  const emailed = pick(params.emel);
  const filtered = !!(filters.fund || filters.category || filters.direction);

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
          <p className="mt-1 text-muted">{t("lead")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/kewangan/kutipan"
            className="inline-flex min-h-tap items-center gap-2 rounded-chip border border-border bg-surface px-4 font-semibold text-primary-dark"
          >
            <HandCoins aria-hidden className="size-4" />
            {t("collectionsLink")}
          </Link>
          {can(role, "receipts.view") ? (
            <Link
              href="/kewangan/resit"
              className="inline-flex min-h-tap items-center gap-2 rounded-chip border border-border bg-surface px-4 font-semibold text-primary-dark"
            >
              <ReceiptText aria-hidden className="size-4" />
              {t("receiptsLink")}
            </Link>
          ) : null}
          {can(role, "funds.manage") ? (
            <Link
              href="/tetapan/dana"
              className="inline-flex min-h-tap items-center gap-2 rounded-chip border border-border bg-surface px-4 font-semibold text-primary-dark"
            >
              <Settings2 aria-hidden className="size-4" />
              {t("fundsLink")}
            </Link>
          ) : null}
          {can(role, "transactions.record") ? (
            <Link
              href="/kewangan/baru"
              className="inline-flex min-h-tap items-center gap-2 rounded-chip bg-primary px-4 font-semibold text-surface"
            >
              <Plus aria-hidden className="size-4" />
              {t("record")}
            </Link>
          ) : null}
        </div>
      </div>

      {savedId ? (
        <div className="mt-4">
          <Notice tone="success">
            {t("saved")}{" "}
            <Link href={`/kewangan/${savedId}`} className="font-semibold underline underline-offset-4">
              {t("view")}
            </Link>
          </Notice>
          {emailed === "ok" ? <div className="mt-2"><Notice tone="success">{t("emailedOk")}</Notice></div> : null}
          {emailed === "gagal" ? <div className="mt-2"><Notice tone="error">{t("emailedFailed")}</Notice></div> : null}
        </div>
      ) : null}

      <nav aria-label={t("month")} className="mt-5 flex items-center justify-between gap-2 rounded-card bg-surface px-2 py-1">
        <Link
          href={`/kewangan?${query({ bulan: shiftMonth(month, -1) })}`}
          className="inline-flex min-h-tap items-center gap-1 px-2 text-sm font-semibold text-primary-dark"
        >
          <ChevronLeft aria-hidden className="size-4" />
          <span className="sr-only sm:not-sr-only">{t("previousMonth")}</span>
        </Link>
        <h2 className="text-lg font-bold">{formatMonth(month, locale)}</h2>
        <Link
          href={`/kewangan?${query({ bulan: shiftMonth(month, 1) })}`}
          className="inline-flex min-h-tap items-center gap-1 px-2 text-sm font-semibold text-primary-dark"
        >
          <span className="sr-only sm:not-sr-only">{t("nextMonth")}</span>
          <ChevronRight aria-hidden className="size-4" />
        </Link>
      </nav>

      <form className="mt-3 grid gap-2 rounded-card bg-surface p-4 sm:grid-cols-[1fr_1fr_1fr_auto]">
        <input type="hidden" name="bulan" value={month} />
        <label className="block text-sm">
          <span className="font-semibold">{t("fund")}</span>
          <select name="dana" defaultValue={filters.fund} className="mt-1 block min-h-tap w-full rounded-chip border border-border bg-surface px-3">
            <option value="">{t("allFunds")}</option>
            {funds.map((fund) => (
              <option key={fund.id} value={fund.id}>
                {fund.archived_at ? t("archivedName", { name: fund.name }) : fund.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="font-semibold">{t("category")}</span>
          <select
            name="kategori"
            defaultValue={filters.category}
            className="mt-1 block min-h-tap w-full rounded-chip border border-border bg-surface px-3"
          >
            <option value="">{t("allCategories")}</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {`${category.name} (${t(category.type === "income" ? "in" : "out")})`}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="font-semibold">{t("direction")}</span>
          <select name="jenis" defaultValue={filters.direction} className="mt-1 block min-h-tap w-full rounded-chip border border-border bg-surface px-3">
            <option value="">{t("allDirections")}</option>
            <option value="in">{t("in")}</option>
            <option value="out">{t("out")}</option>
          </select>
        </label>
        <div className="flex items-end gap-2">
          <button type="submit" className="min-h-tap rounded-chip bg-primary px-4 font-semibold text-surface">
            {t("filter")}
          </button>
          {filtered ? (
            <Link href={`/kewangan?bulan=${month}`} className="inline-flex min-h-tap items-center px-2 text-sm font-semibold text-primary-dark underline underline-offset-4">
              {t("clear")}
            </Link>
          ) : null}
        </div>
      </form>

      <section aria-label={t("totals")} className="mt-3 grid grid-cols-2 gap-4 rounded-card bg-surface p-4 sm:grid-cols-3 lg:grid-cols-5">
        {summary ? <Figure label={t("opening")} sen={summary.opening_sen} /> : null}
        <Figure label={t("totalIn")} sen={sums.in_sen} />
        <Figure label={t("totalOut")} sen={sums.out_sen} />
        <Figure label={t("net")} sen={sums.net_sen} />
        {summary ? <Figure label={t("closing")} sen={summary.closing_sen} emphasis /> : null}
      </section>
      {!showBalance ? <p className="mt-2 text-sm text-muted">{t("runningHint")}</p> : null}

      <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-bold">{t("entries", { count: rows.length })}</h2>
        {rows.length > 0 ? (
          <a
            href={`/kewangan/eksport?${query({})}`}
            download
            className="inline-flex min-h-tap items-center gap-2 text-sm font-semibold text-primary-dark underline underline-offset-4"
          >
            <Download aria-hidden className="size-4" />
            {t("export")}
          </a>
        ) : null}
      </div>

      {rows.length === 0 ? (
        <p className="mt-3 rounded-card bg-surface p-6 text-muted">{filtered ? t("emptyFiltered") : t("empty")}</p>
      ) : (
        <ul className="mt-3 divide-y divide-rule rounded-card bg-surface" data-testid="lejar">
          {rows.map((row, index) => {
            const isReversed = reversed.has(row.id);
            const details = [
              fundName.get(row.fund_id),
              t(`methods.${row.method}`),
              row.receipt_no,
              row.ref_no,
            ].filter(Boolean);
            return (
              <li key={row.id}>
                <Link
                  href={`/kewangan/${row.id}`}
                  className="flex min-h-tap items-start gap-3 px-4 py-3 hover:bg-background"
                  data-testid="lejar-baris"
                >
                  <span className="w-14 shrink-0 pt-0.5 text-sm text-muted">{formatDay(row.date, locale, false)}</span>
                  <span className="min-w-0 flex-1">
                    <span className={`flex flex-wrap items-center gap-2 font-semibold ${isReversed ? "text-muted line-through" : ""}`}>
                      {(row.category_id && categoryName.get(row.category_id)) || t("noCategory")}
                    </span>
                    <span className="mt-0.5 flex flex-wrap items-center gap-2">
                      {isReversed ? <Badge tone="warn">{t("cancelled")}</Badge> : null}
                      {row.reverses_id ? <Badge tone="plain">{t("reversal")}</Badge> : null}
                      <span className="text-sm text-muted">{details.join(" · ")}</span>
                    </span>
                    {row.note || row.reversal_reason ? (
                      <span className="mt-0.5 block truncate text-sm text-muted">{row.reversal_reason ?? row.note}</span>
                    ) : null}
                  </span>
                  <span className="shrink-0 text-right">
                    <SignedAmount sen={row.amount_sen} direction={row.direction} className={isReversed ? "line-through opacity-70" : ""} />
                    {showBalance ? (
                      <span className="mt-0.5 block text-xs text-muted tabular-nums">
                        {t("balanceAfter", { amount: formatSen(balances[index]) })}
                      </span>
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
