"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Calculator } from "lucide-react";
import { breakdownTotal, cleanBreakdown, NOTES, parseCount, type Breakdown } from "@/lib/collections";
import { formatSen, parseRinggit } from "@/lib/money";

const input =
  "block min-h-tap w-full rounded-chip border border-border bg-surface px-4 py-3 text-base text-ink tabular-nums placeholder:text-muted";

/**
 * The counted amount, typed as one figure or added up from notes and coins.
 * Sends `total_sen` and `breakdown` (JSON) as hidden fields. The figure shown
 * is the one that is saved.
 */
export function AmountField({ label, autoFocus = false }: { label: string; autoFocus?: boolean }) {
  const t = useTranslations("kutipan");
  const [useBreakdown, setUseBreakdown] = useState(false);
  const [typed, setTyped] = useState("");
  const [counts, setCounts] = useState<Record<string, string>>({});
  const [coins, setCoins] = useState("");

  let totalSen: number | null = null;
  let breakdown: Breakdown | null = null;
  let problem: string | null = null;

  if (useBreakdown) {
    const parsed: Breakdown = {};
    for (const note of NOTES) {
      const count = parseCount(counts[note] ?? "");
      if (count === null) problem = t("countBad");
      else parsed[`${note}`] = count;
    }
    if (coins.trim()) {
      const coinAmount = parseRinggit(coins);
      if (coinAmount.ok) parsed.coins_sen = coinAmount.sen;
      else problem = t("coinsBad");
    }
    breakdown = cleanBreakdown(parsed);
    const total = breakdownTotal(parsed);
    totalSen = !problem && total > 0 ? total : null;
  } else if (typed.trim()) {
    const amount = parseRinggit(typed);
    if (amount.ok) totalSen = amount.sen;
    else problem = t("amountBad");
  }

  return (
    <fieldset className="space-y-3">
      <legend className="font-semibold">{label}</legend>
      <input type="hidden" name="total_sen" value={totalSen ?? ""} />
      <input type="hidden" name="breakdown" value={useBreakdown && breakdown ? JSON.stringify(breakdown) : ""} />

      {useBreakdown ? (
        <div className="space-y-2 rounded-card border border-border bg-surface p-3">
          {NOTES.map((note) => {
            const count = parseCount(counts[note] ?? "");
            return (
              <label key={note} className="grid grid-cols-[4.5rem_1fr_auto] items-center gap-3">
                <span className="font-semibold">RM{note}</span>
                <input
                  inputMode="numeric"
                  autoComplete="off"
                  aria-label={t("noteCount", { note })}
                  placeholder="0"
                  value={counts[note] ?? ""}
                  onChange={(event) => setCounts({ ...counts, [note]: event.target.value })}
                  className={input}
                />
                <span className="w-28 text-right text-sm text-muted tabular-nums">
                  {count ? formatSen(count * note * 100) : ""}
                </span>
              </label>
            );
          })}
          <label className="grid grid-cols-[4.5rem_1fr_auto] items-center gap-3">
            <span className="font-semibold">{t("coins")}</span>
            <input
              inputMode="decimal"
              autoComplete="off"
              aria-label={t("coinsLabel")}
              placeholder="0.00"
              value={coins}
              onChange={(event) => setCoins(event.target.value)}
              className={input}
            />
            <span className="w-28" />
          </label>
        </div>
      ) : (
        <span className="relative block">
          <span aria-hidden className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 font-semibold text-muted">
            RM
          </span>
          <input
            name="amount_typed"
            inputMode="decimal"
            autoComplete="off"
            autoFocus={autoFocus}
            aria-label={label}
            placeholder="0.00"
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
            className={`${input} pl-12 text-2xl font-bold`}
          />
        </span>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setUseBreakdown(!useBreakdown)}
          className="inline-flex min-h-tap items-center gap-2 text-sm font-semibold text-primary-dark underline underline-offset-4"
        >
          <Calculator aria-hidden className="size-4" />
          {useBreakdown ? t("typeTotal") : t("useBreakdown")}
        </button>
        {useBreakdown ? (
          <p className="text-lg font-bold tabular-nums" aria-live="polite" data-testid="jumlah-pecahan">
            {t("total")}: {formatSen(totalSen ?? 0)}
          </p>
        ) : null}
      </div>
      {problem ? (
        <p className="text-sm text-warn-ink" role="alert">
          {problem}
        </p>
      ) : null}
    </fieldset>
  );
}
