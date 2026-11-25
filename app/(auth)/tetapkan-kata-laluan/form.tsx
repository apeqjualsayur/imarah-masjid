"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Field, Notice, SubmitButton, TextInput } from "@/components/ui/forms";
import { updatePassword, type FormState } from "../actions";

export function NewPasswordForm() {
  const t = useTranslations("auth");
  const errors = useTranslations("errors");
  const [state, action] = useActionState(updatePassword, {} as FormState);

  if (state.done) {
    return (
      <div className="mt-6 space-y-4">
        <Notice tone="success">{t("passwordSaved")}</Notice>
        <Link
          href="/"
          className="inline-flex min-h-tap w-full items-center justify-center rounded-chip bg-primary px-5 font-semibold text-surface"
        >
          {t("goHome")}
        </Link>
      </div>
    );
  }

  return (
    <form action={action} className="mt-6 space-y-4">
      {state.error ? <Notice tone="error">{errors(state.error)}</Notice> : null}
      <Field label={t("newPassword")} hint={t("passwordHint")}>
        <TextInput name="password" type="password" autoComplete="new-password" minLength={8} required />
      </Field>
      <Field label={t("confirmPassword")}>
        <TextInput name="confirm" type="password" autoComplete="new-password" minLength={8} required />
      </Field>
      <SubmitButton pendingLabel={t("saving")} className="w-full">
        {t("savePassword")}
      </SubmitButton>
    </form>
  );
}
