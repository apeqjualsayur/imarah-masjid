"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Field, Notice, SubmitButton, TextArea } from "@/components/ui/forms";
import { reverseTransaction, type ReverseState } from "@/app/(app)/kewangan/actions";
import { REASON_MAX } from "@/lib/cashbook";

/** Cancels an entry with a reason. Asks once more before saving. */
export function ReverseForm({ id, canRecord }: { id: string; canRecord: boolean }) {
  const t = useTranslations("transaksi");
  const errors = useTranslations("errors");
  const [state, action] = useActionState(reverseTransaction.bind(null, id), {} as ReverseState);

  return (
    <form
      action={action}
      onSubmit={(event) => {
        if (!window.confirm(t("confirmCancel"))) event.preventDefault();
      }}
      className="mt-3 space-y-3"
    >
      {state.error ? <Notice tone="error">{errors(state.error)}</Notice> : null}
      <Field label={t("reason")} hint={t("reasonHint")}>
        <TextArea name="reason" rows={2} required maxLength={REASON_MAX} />
      </Field>
      <p className="text-sm text-muted">{canRecord ? t("cancelThenEnter") : t("cancelOnly")}</p>
      <SubmitButton variant="secondary" pendingLabel={t("cancelling")}>
        {t("cancel")}
      </SubmitButton>
    </form>
  );
}
