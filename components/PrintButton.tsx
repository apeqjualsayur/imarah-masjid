"use client";

import { Printer } from "lucide-react";

export function PrintButton({ label }: { label: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex min-h-tap items-center gap-2 rounded-chip border border-border bg-surface px-4 font-semibold text-primary-dark"
    >
      <Printer aria-hidden className="size-4" />
      {label}
    </button>
  );
}
