import Link from "next/link";
import { ChevronLeft, ChevronRight, Upload } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { BackLink } from "@/components/BackLink";
import { Badge, Figure, SignedAmount } from "@/components/kewangan/bits";
import { Notice, SubmitButton } from "@/components/ui/forms";
import { reconcile, suggestMatches, type BankRow } from "@/lib/bank-matching";
import { currentMonth, parseMonth, shiftMonth } from "@/lib/cashbook";
import { formatDay, formatMonth } from "@/lib/dates";
import { formatSen } from "@/lib/money";
import { can } from "@/lib/permissions";
import { requireMember } from "@/lib/session";
import { loadCategories, isMonthLocked } from "../data";
import { acceptMatch, clearLine, rejectSuggestion } from "./actions";
import { loadBankMonth, type BankEntry } from "./data";

const pick = (value: string | string[] | undefined) => (typeof value === "string" ? value : "");

function LineAmount({ sen }: { sen: number }) {
  return <SignedAmount sen={Math.abs(sen)} direction={sen > 0 ? "in" : "out"} className="shrink-0 font-semibold" />;
}

export default async function BankPage({ searchParams }: PageProps<"/kewangan/bank">) {
  const { role } = await requireMember("bank.view");
  const [t, errors, k] = await Promise.all([getTranslations("bank"), getTranslations("errors"), getTranslations("kewangan")]);
  const locale = await getLocale();
  const params = await searchParams;
  const month = parseMonth(params.bulan) ?? currentMonth();
  const writer = can(role, "bank.match");
  const back = `/kewangan/bank?bulan=${month}`;

  const [data, categories, locked] = await Promise.all([loadBankMonth(month), loadCategories(), isMonthLocked(month)]);
  const r = reconcile(month, data.lines, data.entries, data.matchedBy, data.matchedDates);
  const suggestions = suggestMatches(r.unmatchedLines, data.entries, new Set(data.matchedBy.keys()));
  const categoryName = new Map(categories.map((category) => [category.id, category.name]));
  const canAct = writer && !locked;

  const entryLine = (entry: BankEntry) =>
    [formatDay(entry.date, locale), entry.category_id ? categoryName.get(entry.category_id) : null, entry.note, entry.ref_no, k(`methods.${entry.method}`)]
      .filter(Boolean)
      .join(" · ");

  const imported = pick(params.import);
  const done = pick(params.ok);
  const failed = pick(params.ralat);
  const balanced = r.difference_sen === 0 && data.lines.length > 0;

  const lineText = (line: BankRow) => (
    <span className="min-w-0">
      <span className="block text-sm text-muted">{formatDay(line.date, locale)}</span>
      <span className="block font-medium break-words">{line.description || t("noDescription")}</span>
    </span>
  );

  return (
    <>
      <BackLink href="/kewangan" label={k("title")} />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
          <p className="mt-1 max-w-2xl text-muted">{t("lead")}</p>
        </div>
        {writer ? (
          <Link
            href="/kewangan/bank/import"
            className="inline-flex min-h-tap items-center gap-2 rounded-chip bg-primary px-4 font-semibold text-surface"
          >
            <Upload aria-hidden className="size-4" />
            {t("import")}
          </Link>
        ) : null}
      </div>

      <div className="mt-4 space-y-2">
        {imported ? <Notice tone="success">{t("imported", { count: Number(imported) || 0 })}</Notice> : null}
        {done ? <Notice tone="success">{t(`done.${done}`)}</Notice> : null}
        {failed ? <Notice tone="error">{errors(failed)}</Notice> : null}
        {locked ? <Notice tone="error">{t("locked")}</Notice> : null}
      </div>

      <nav aria-label={k("month")} className="mt-5 flex items-center justify-between gap-2 rounded-card bg-surface px-2 py-1">
        <Link href={`/kewangan/bank?bulan=${shiftMonth(month, -1)}`} className="inline-flex min-h-tap items-center gap-1 px-2 text-sm font-semibold text-primary-dark">
          <ChevronLeft aria-hidden className="size-4" />
          <span className="sr-only sm:not-sr-only">{k("previousMonth")}</span>
        </Link>
        <h2 className="text-lg font-bold">{formatMonth(month, locale)}</h2>
        <Link href={`/kewangan/bank?bulan=${shiftMonth(month, 1)}`} className="inline-flex min-h-tap items-center gap-1 px-2 text-sm font-semibold text-primary-dark">
          <span className="sr-only sm:not-sr-only">{k("nextMonth")}</span>
          <ChevronRight aria-hidden className="size-4" />
        </Link>
      </nav>

      <section aria-labelledby="ringkasan" className="mt-4 rounded-card bg-surface p-5" data-testid="bank-ringkasan">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="ringkasan" className="text-lg font-bold">
            {t("summaryTitle")}
          </h2>
          {data.lines.length === 0 ? null : balanced ? <Badge tone="teal">{t("balanced")}</Badge> : <Badge tone="warn">{t("notBalanced")}</Badge>}
        </div>
        <div className="mt-3 grid gap-4 sm:grid-cols-3">
          <Figure label={t("bankTotal")} sen={r.bank_sen} />
          <Figure label={t("ledgerTotal")} sen={r.ledger_sen} />
          <div data-testid="bank-beza">
            <Figure label={t("difference")} sen={r.difference_sen} emphasis />
          </div>
        </div>
        <p className="mt-3 text-sm text-muted">
          {t("ledgerExplain", { entries: formatSen(r.entries_sen), cash: formatSen(r.cash_sen) })}
        </p>
      </section>

      {data.lines.length === 0 ? (
        <p className="mt-4 rounded-card bg-surface p-6 text-muted" data-testid="bank-kosong">
          {t("empty")}
        </p>
      ) : null}

      {r.unmatchedLines.length > 0 ? (
        <section aria-labelledby="belum" className="mt-5">
          <h2 id="belum" className="text-lg font-bold">
            {t("unmatchedLines", { count: r.unmatchedLines.length })}
          </h2>
          <p className="text-sm text-muted">{t("unmatchedLinesLead")}</p>
          <ul className="mt-2 space-y-2" data-testid="bank-belum">
            {r.unmatchedLines.map((line) => {
              const suggestion = suggestions.get(line.id);
              const entry = suggestion ? data.entryById.get(suggestion) : undefined;
              const stale = !!line.matched_transaction_id;
              return (
                <li key={line.id} className="rounded-card bg-surface p-4" data-testid="bank-baris">
                  <div className="flex items-start justify-between gap-3">
                    {lineText(line)}
                    <LineAmount sen={line.amount_sen} />
                  </div>
                  {stale ? (
                    <p className="mt-2 text-sm">
                      <Badge tone="warn">{t("staleMatch")}</Badge>
                    </p>
                  ) : null}
                  {entry ? (
                    <div className="mt-3 rounded-chip bg-tint p-3" data-testid="bank-cadangan">
                      <p className="text-sm font-semibold text-primary-dark">{t("suggestion")}</p>
                      <p className="text-sm">{entryLine(entry)}</p>
                      {canAct ? (
                        <div className="mt-2 flex flex-wrap gap-2">
                          <form action={acceptMatch.bind(null, back, line.id, entry.id)}>
                            <SubmitButton pendingLabel={t("working")}>{t("accept")}</SubmitButton>
                          </form>
                          <form action={rejectSuggestion.bind(null, back, line.id, entry.id)}>
                            <SubmitButton variant="secondary" pendingLabel={t("working")}>
                              {t("reject")}
                            </SubmitButton>
                          </form>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                  {writer ? (
                    <Link href={`/kewangan/bank/${line.id}`} className="mt-3 inline-flex min-h-tap items-center font-semibold text-primary-dark underline underline-offset-4">
                      {entry ? t("otherChoices") : t("choose")}
                    </Link>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {r.unmatchedEntries.length > 0 ? (
        <section aria-labelledby="lejar" className="mt-5">
          <h2 id="lejar" className="text-lg font-bold">
            {t("unmatchedEntries", { count: r.unmatchedEntries.length })}
          </h2>
          <p className="text-sm text-muted">{t("unmatchedEntriesLead")}</p>
          <ul className="mt-2 divide-y divide-rule rounded-card bg-surface" data-testid="bank-lejar">
            {r.unmatchedEntries.map((entry) => (
              <li key={entry.id}>
                <Link href={`/kewangan/${entry.id}`} className="flex min-h-tap items-start justify-between gap-3 px-4 py-3">
                  <span className="min-w-0 text-sm">
                    {entryLine(entry)}
                    {entry.reversed ? <span className="ml-2"><Badge tone="warn">{t("cancelledEntry")}</Badge></span> : null}
                    {entry.reverses_id ? <span className="ml-2"><Badge tone="plain">{t("reversalEntry")}</Badge></span> : null}
                  </span>
                  <SignedAmount sen={entry.amount_sen} direction={entry.direction} className="shrink-0 font-semibold" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {r.otherMonthLines.length + r.otherMonthEntries.length > 0 ? (
        <section aria-labelledby="lain" className="mt-5">
          <h2 id="lain" className="text-lg font-bold">
            {t("otherMonth")}
          </h2>
          <p className="text-sm text-muted">{t("otherMonthLead")}</p>
          <ul className="mt-2 divide-y divide-rule rounded-card bg-surface text-sm">
            {r.otherMonthLines.map((line) => (
              <li key={line.id} className="flex items-start justify-between gap-3 px-4 py-3">
                <span>
                  {t("otherMonthLine", { date: formatDay(line.date, locale), entryDate: formatDay(data.matchedDates.get(line.matched_transaction_id!)!.date, locale) })}
                </span>
                <LineAmount sen={line.amount_sen} />
              </li>
            ))}
            {r.otherMonthEntries.map((entry) => (
              <li key={entry.id} className="flex items-start justify-between gap-3 px-4 py-3">
                <span>{t("otherMonthEntry", { date: formatDay(entry.date, locale), lineDate: formatDay(data.matchedBy.get(entry.id)!, locale) })}</span>
                <SignedAmount sen={entry.amount_sen} direction={entry.direction} className="shrink-0 font-semibold" />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {r.matchedLines.length + r.cashLines.length > 0 ? (
        <details className="mt-5 rounded-card bg-surface p-4" data-testid="bank-sudah">
          <summary className="min-h-tap cursor-pointer py-2 font-bold">
            {t("explained", { count: r.matchedLines.length + r.cashLines.length })}
          </summary>
          <ul className="mt-2 divide-y divide-rule">
            {[...r.matchedLines, ...r.cashLines].map((line) => {
              const entry = line.matched_transaction_id ? data.entryById.get(line.matched_transaction_id) : undefined;
              return (
                <li key={line.id} className="py-3">
                  <div className="flex items-start justify-between gap-3">
                    {lineText(line)}
                    <LineAmount sen={line.amount_sen} />
                  </div>
                  <p className="mt-1 text-sm text-muted">
                    {line.cash_transfer ? (line.amount_sen > 0 ? t("cashDeposit") : t("cashWithdrawal")) : entry ? t("matchedTo", { entry: entryLine(entry) }) : null}
                  </p>
                  {canAct ? (
                    <form action={clearLine.bind(null, back, line.id)} className="mt-1">
                      <SubmitButton variant="quiet" className="px-0" pendingLabel={t("working")}>
                        {line.cash_transfer ? t("unmarkCash") : t("unmatch")}
                      </SubmitButton>
                    </form>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </details>
      ) : null}
    </>
  );
}
