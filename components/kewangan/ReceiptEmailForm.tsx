"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Field, Notice, SubmitButton, TextInput } from "@/components/ui/forms";
import { emailReceipt, type EmailState } from "@/app/(app)/kewangan/resit/actions";

/** Emails the receipt PDF to a donor. The address is not saved. */
export function ReceiptEmailForm({ id }: { id: string }) {
  const t = useTranslations("resit");
  const errors = useTranslations("errors");
  const [state, action] = useActionState(emailReceipt.bind(null, id), {} as EmailState);

  return (
    <form action={action} className="mt-3 space-y-3" key={state.sent ? `sent-${state.n}` : "form"}>
      {state.error ? <Notice tone="error">{errors(state.error)}</Notice> : null}
      {state.sent ? <Notice tone="success">{t("emailSent")}</Notice> : null}
      <Field label={t("emailLabel")} hint={t("emailHint")}>
        <TextInput name="email" type="email" autoComplete="off" required />
      </Field>
      <SubmitButton variant="secondary" pendingLabel={t("emailSending")}>
        {t("emailSend")}
      </SubmitButton>
    </form>
  );
}
