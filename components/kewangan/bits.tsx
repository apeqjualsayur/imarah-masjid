import type { ReactNode } from "react";
import { formatSen } from "@/lib/money";

/** "+RM 1,930.00" or "−RM 1,284.60". The sign is in the text, not only the colour. */
export function SignedAmount({ sen, direction, className = "" }: { sen: number; direction: "in" | "out"; className?: string }) {
  const tone = direction === "in" ? "text-primary-dark" : "text-warn-ink";
  return (
    <span className={`font-semibold tabular-nums whitespace-nowrap ${tone} ${className}`}>
      {direction === "in" ? "+" : "−"}
      {formatSen(sen)}
    </span>
  );
}

export function Badge({ tone, children }: { tone: "warn" | "teal" | "gold" | "plain"; children: ReactNode }) {
  const styles = {
    warn: "bg-warn-bg text-warn-ink",
    teal: "bg-tint text-primary-dark",
    gold: "bg-gold-tint text-warn-ink",
    plain: "bg-rule text-muted",
  };
  return <span className={`inline-flex items-center rounded-pill px-2.5 py-0.5 text-xs font-semibold ${styles[tone]}`}>{children}</span>;
}

/** A labelled figure: "Jumlah masuk / RM 1,234.50". */
export function Figure({ label, sen, emphasis = false }: { label: string; sen: number; emphasis?: boolean }) {
  return (
    <div className="min-w-0">
      <p className="text-sm text-muted">{label}</p>
      <p className={`mt-0.5 font-bold tabular-nums ${emphasis ? "text-xl text-primary-dark" : "text-lg"}`}>{formatSen(sen)}</p>
    </div>
  );
}
