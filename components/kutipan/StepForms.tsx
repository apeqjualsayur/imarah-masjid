"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Field, Notice, SubmitButton, TextArea } from "@/components/ui/forms";
import { cancelCount, confirmCount, recount, type StepState } from "@/app/(app)/kewangan/kutipan/actions";
import { REASON_MAX } from "@/lib/cashbook";
import { AmountField } from "./AmountField";

function ErrorLine({ state }: { state: StepState }) {
  const errors = useTranslations("errors");
  return state.error ? <Notice tone="error">{errors(state.error)}</Notice> : null;
}

/** The second person counts for themselves. The first count is not shown, so this is a real check. */
export function ConfirmForm({ id }: { id: string }) {
  const t = useTranslations("kutipan");
  const [state, action] = useActionState(confirmCount.bind(null, id), {} as StepState);
  return (
    <form action={action} key={state.n ?? 0} className="mt-3 space-y-4">
      <ErrorLine state={state} />
      <AmountField label={t("yourCount")} />
      <SubmitButton pendingLabel={t("confirming")}>{t("confirm")}</SubmitButton>
    </form>
  );
}

export function RecountForm({ id }: { id: string }) {
  const t = useTranslations("kutipan");
  const [state, action] = useActionState(recount.bind(null, id), {} as StepState);
  return (
    <form action={action} key={state.n ?? 0} className="mt-3 space-y-4">
      <ErrorLine state={state} />
      <AmountField label={t("newCount")} />
      <SubmitButton pendingLabel={t("saving")}>{t("saveRecount")}</SubmitButton>
    </form>
  );
}

export function CancelForm({ id }: { id: string }) {
  const t = useTranslations("kutipan");
  const [state, action] = useActionState(cancelCount.bind(null, id), {} as StepState);
  return (
    <form
      action={action}
      onSubmit={(event) => {
        if (!window.confirm(t("confirmCancel"))) event.preventDefault();
      }}
      className="mt-3 space-y-3"
    >
      <ErrorLine state={state} />
      <Field label={t("cancelReason")}>
        <TextArea name="reason" rows={2} required maxLength={REASON_MAX} />
      </Field>
      <SubmitButton variant="secondary" pendingLabel={t("cancelling")}>
        {t("cancelCount")}
      </SubmitButton>
    </form>
  );
}
