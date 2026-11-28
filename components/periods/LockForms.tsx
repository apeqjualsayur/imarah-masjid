"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { lockMonth, unlockMonth, type PeriodState } from "@/app/(app)/kewangan/tutup-bulan/actions";
import { Field, Notice, SubmitButton, TextArea } from "@/components/ui/forms";
import { UNLOCK_REASON_MAX } from "@/lib/periods";

/** "Kunci bulan". With warnings, the Pengerusi ticks that they have read them. */
export function LockForm({ month, blocked, warnings }: { month: string; blocked: boolean; warnings: number }) {
  const t = useTranslations("tutupBulan");
  const errors = useTranslations("errors");
  const [state, action] = useActionState(lockMonth.bind(null, month), {} as PeriodState);

  return (
    <form action={action} className="space-y-3">
      {state.error ? <Notice tone="error">{errors(state.error)}</Notice> : null}
      {blocked ? <Notice tone="error">{t("blocked")}</Notice> : null}
      <input type="hidden" name="warnings" value={warnings > 0 ? "1" : "0"} />
      {warnings > 0 && !blocked ? (
        <label className="flex min-h-tap cursor-pointer items-center gap-3">
          <input type="checkbox" name="understood" required className="size-5 accent-primary" />
          <span className="font-medium">{t("understood", { count: warnings })}</span>
        </label>
      ) : null}
      <SubmitButton pendingLabel={t("locking")} disabled={blocked}>
        {t("lock")}
      </SubmitButton>
    </form>
  );
}

/** "Buka kunci" with a reason. */
export function UnlockForm({ month }: { month: string }) {
  const t = useTranslations("tutupBulan");
  const errors = useTranslations("errors");
  const [state, action] = useActionState(unlockMonth.bind(null, month), {} as PeriodState);

  return (
    <form action={action} className="space-y-3" key={state.n ?? 0}>
      {state.error ? <Notice tone="error">{errors(state.error)}</Notice> : null}
      <Field label={t("reason")} hint={t("reasonHint")}>
        <TextArea name="reason" rows={3} required maxLength={UNLOCK_REASON_MAX} defaultValue={state.reason ?? ""} />
      </Field>
      <SubmitButton variant="secondary" pendingLabel={t("unlocking")}>
        {t("unlock")}
      </SubmitButton>
    </form>
  );
}
