import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { BackLink } from "@/components/BackLink";
import { Badge } from "@/components/kewangan/bits";
import { currentMonth, monthRange, parseMonth, shiftMonth } from "@/lib/cashbook";
import { formatDay, formatMonth } from "@/lib/dates";
import { formatSen } from "@/lib/money";
import { requireMember } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { loadFunds, TRANSACTION_COLUMNS, type Transaction } from "../data";

const pick = (value: string | string[] | undefined) => (typeof value === "string" ? value : "");

export default async function ReceiptsPage({ searchParams }: PageProps<"/kewangan/resit">) {
  await requireMember("receipts.view");
  const [t, k, locale, params] = await Promise.all([getTranslations("resit"), getTranslations("kewangan"), getLocale(), searchParams]);

  const month = parseMonth(params.bulan) ?? currentMonth();
  // A search by number looks across every month: "0042" or "RC-2026-0042".
  const search = pick(params.cari).trim().toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 20);

  const supabase = await createClient();
  let query = supabase.from("transactions").select(TRANSACTION_COLUMNS).not("receipt_no", "is", null).limit(1000);
  if (search) {
    query = query.ilike("receipt_no", `%${search}%`).order("date", { ascending: false });
  } else {
    const { from, to } = monthRange(month);
    query = query.gte("date", from).lte("date", to).order("date", { ascending: false }).order("created_at", { ascending: false });
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as (Transaction & { receipt_no: string })[];

  const ids = rows.map((row) => row.id);
  const [{ data: cancels }, funds] = await Promise.all([
    ids.length
      ? supabase.from("transactions").select("reverses_id").in("reverses_id", ids)
      : Promise.resolve({ data: [] as { reverses_id: string }[] }),
    loadFunds(),
  ]);
  const cancelled = new Set((cancels ?? []).map((row) => row.reverses_id));
  const fundName = new Map(funds.map((fund) => [fund.id, fund.name]));

  return (
    <>
      <BackLink href="/kewangan" label={k("title")} />
      <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
      <p className="mt-1 text-muted">{t("lead")}</p>

      <form className="mt-5 flex flex-wrap items-end gap-2 rounded-card bg-surface p-4">
        <input type="hidden" name="bulan" value={month} />
        <label className="block min-w-48 flex-1 text-sm">
          <span className="font-semibold">{t("search")}</span>
          <input
            name="cari"
            defaultValue={search}
            placeholder={t("searchHint")}
            autoComplete="off"
            className="mt-1 block min-h-tap w-full rounded-chip border border-border bg-surface px-3"
          />
        </label>
        <button type="submit" className="min-h-tap rounded-chip bg-primary px-4 font-semibold text-surface">
          {t("find")}
        </button>
        {search ? (
          <Link href={`/kewangan/resit?bulan=${month}`} className="inline-flex min-h-tap items-center px-2 text-sm font-semibold text-primary-dark underline underline-offset-4">
            {t("clear")}
          </Link>
        ) : null}
      </form>

      {search ? null : (
        <nav aria-label={k("month")} className="mt-3 flex items-center justify-between gap-2 rounded-card bg-surface px-2 py-1">
          <Link href={`/kewangan/resit?bulan=${shiftMonth(month, -1)}`} className="inline-flex min-h-tap items-center gap-1 px-2 text-sm font-semibold text-primary-dark">
            <ChevronLeft aria-hidden className="size-4" />
            <span className="sr-only sm:not-sr-only">{k("previousMonth")}</span>
          </Link>
          <h2 className="text-lg font-bold">{formatMonth(month, locale)}</h2>
          <Link href={`/kewangan/resit?bulan=${shiftMonth(month, 1)}`} className="inline-flex min-h-tap items-center gap-1 px-2 text-sm font-semibold text-primary-dark">
            <span className="sr-only sm:not-sr-only">{k("nextMonth")}</span>
            <ChevronRight aria-hidden className="size-4" />
          </Link>
        </nav>
      )}

      <h2 className="mt-5 text-lg font-bold">{search ? t("found", { count: rows.length }) : t("count", { count: rows.length })}</h2>

      {rows.length === 0 ? (
        <p className="mt-3 rounded-card bg-surface p-6 text-muted">{search ? t("noneFound") : t("empty")}</p>
      ) : (
        <ul className="mt-3 divide-y divide-rule rounded-card bg-surface" data-testid="senarai-resit">
          {rows.map((row) => {
            const isCancelled = cancelled.has(row.id);
            return (
              <li key={row.id}>
                <Link href={`/kewangan/resit/${row.id}`} className="flex min-h-tap items-start gap-3 px-4 py-3 hover:bg-background" data-testid="resit-baris">
                  <span className="min-w-0 flex-1">
                    <span className={`flex flex-wrap items-center gap-2 font-semibold ${isCancelled ? "text-muted line-through" : ""}`}>{row.receipt_no}</span>
                    <span className="mt-0.5 flex flex-wrap items-center gap-2">
                      {isCancelled ? <Badge tone="warn">{t("cancelledBadge")}</Badge> : null}
                      <span className="text-sm text-muted">
                        {[formatDay(row.date, locale), fundName.get(row.fund_id), row.received_from].filter(Boolean).join(" · ")}
                      </span>
                    </span>
                  </span>
                  <span className={`shrink-0 font-semibold tabular-nums ${isCancelled ? "line-through opacity-70" : "text-primary-dark"}`}>
                    {formatSen(Number(row.amount_sen))}
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
