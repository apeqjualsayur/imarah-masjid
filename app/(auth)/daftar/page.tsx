"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Field, Notice, SubmitButton, TextInput } from "@/components/ui/forms";
import { signUp, type FormState } from "../actions";

export default function DaftarPage() {
  const t = useTranslations("auth");
  const errors = useTranslations("errors");
  const [state, action] = useActionState(signUp, {} as FormState);

  return (
    <>
      <h1 className="text-2xl font-bold tracking-tight">{t("signUpTitle")}</h1>
      <p className="mt-1 text-muted">{t("signUpLead")}</p>

      {state.done ? (
        <div className="mt-6">
          <Notice tone="success">{t("signUpDone")}</Notice>
        </div>
      ) : (
        <form action={action} className="mt-6 space-y-4">
          {state.error ? <Notice tone="error">{errors(state.error)}</Notice> : null}
          <Field label={t("fullName")}>
            <TextInput name="fullName" autoComplete="name" required />
          </Field>
          <Field label={t("email")}>
            <TextInput name="email" type="email" autoComplete="email" required />
          </Field>
          <Field label={t("password")} hint={t("passwordHint")}>
            <TextInput name="password" type="password" autoComplete="new-password" minLength={8} required />
          </Field>
          <SubmitButton pendingLabel={t("signingUp")} className="w-full">
            {t("signUp")}
          </SubmitButton>
        </form>
      )}

      <p className="mt-8 text-sm text-muted">
        {t("haveAccount")}{" "}
        <Link href="/log-masuk" className="font-semibold text-primary-dark underline underline-offset-4">
          {t("signIn")}
        </Link>
      </p>
    </>
  );
}
