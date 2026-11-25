"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Field, Notice, SubmitButton, TextInput } from "@/components/ui/forms";
import { requestPasswordReset, type FormState } from "../actions";

export default function LupaKataLaluanPage() {
  const t = useTranslations("auth");
  const errors = useTranslations("errors");
  const [state, action] = useActionState(requestPasswordReset, {} as FormState);

  return (
    <>
      <h1 className="text-2xl font-bold tracking-tight">{t("resetTitle")}</h1>
      <p className="mt-1 text-muted">{t("resetLead")}</p>

      {state.done ? (
        <div className="mt-6">
          <Notice tone="success">{t("resetSent")}</Notice>
        </div>
      ) : (
        <form action={action} className="mt-6 space-y-4">
          {state.error ? <Notice tone="error">{errors(state.error)}</Notice> : null}
          <Field label={t("email")}>
            <TextInput name="email" type="email" autoComplete="email" required />
          </Field>
          <SubmitButton pendingLabel={t("sending")} className="w-full">
            {t("sendReset")}
          </SubmitButton>
        </form>
      )}

      <p className="mt-8 text-sm">
        <Link href="/log-masuk" className="font-semibold text-primary-dark underline underline-offset-4">
          {t("backToSignIn")}
        </Link>
      </p>
    </>
  );
}
