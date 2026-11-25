"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Field, Notice, SubmitButton, TextInput } from "@/components/ui/forms";
import { sendMagicLink, signInWithPassword, type FormState } from "../actions";

export function PasswordForm({ next }: { next: string }) {
  const t = useTranslations("auth");
  const errors = useTranslations("errors");
  const [state, action] = useActionState(signInWithPassword, {} as FormState);

  return (
    <form action={action} className="mt-6 space-y-4">
      <input type="hidden" name="next" value={next} />
      {state.error ? <Notice tone="error">{errors(state.error)}</Notice> : null}
      <Field label={t("email")}>
        <TextInput name="email" type="email" autoComplete="email" required />
      </Field>
      <Field label={t("password")}>
        <TextInput name="password" type="password" autoComplete="current-password" required />
      </Field>
      <SubmitButton pendingLabel={t("signingIn")} className="w-full">
        {t("signIn")}
      </SubmitButton>
    </form>
  );
}

export function MagicLinkForm() {
  const t = useTranslations("auth");
  const errors = useTranslations("errors");
  const [state, action] = useActionState(sendMagicLink, {} as FormState);

  if (state.done) return <Notice tone="success">{t("magicSent")}</Notice>;

  return (
    <form action={action} className="space-y-4">
      <p className="text-sm text-muted">{t("magicLead")}</p>
      {state.error ? <Notice tone="error">{errors(state.error)}</Notice> : null}
      <Field label={t("email")}>
        <TextInput name="email" type="email" autoComplete="email" required />
      </Field>
      <SubmitButton variant="secondary" pendingLabel={t("sending")} className="w-full">
        {t("magicButton")}
      </SubmitButton>
    </form>
  );
}
