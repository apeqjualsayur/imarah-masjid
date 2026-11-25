"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Field, Notice, SubmitButton, TextInput } from "@/components/ui/forms";
import { adminSignIn, type AdminState } from "../actions";

export default function AdminLogMasukPage() {
  const t = useTranslations("admin");
  const auth = useTranslations("auth");
  const errors = useTranslations("errors");
  const [state, action] = useActionState(adminSignIn, {} as AdminState);

  return (
    <div className="mx-auto max-w-md rounded-panel bg-surface p-6 md:p-8">
      <h1 className="text-2xl font-bold tracking-tight">{t("signInTitle")}</h1>
      <p className="mt-1 text-muted">{t("signInLead")}</p>
      <form action={action} className="mt-6 space-y-4">
        {state.error ? <Notice tone="error">{errors(state.error)}</Notice> : null}
        <Field label={auth("email")}>
          <TextInput name="email" type="email" autoComplete="username" required />
        </Field>
        <Field label={auth("password")}>
          <TextInput name="password" type="password" autoComplete="current-password" required />
        </Field>
        <SubmitButton pendingLabel={auth("signingIn")} className="w-full">
          {auth("signIn")}
        </SubmitButton>
      </form>
    </div>
  );
}
