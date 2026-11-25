"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Field, Notice, SubmitButton, TextInput } from "@/components/ui/forms";
import type { FormState } from "../../actions";
import { acceptAsNewUser, acceptSignedIn } from "./actions";

export function NewAccountForm({ token }: { token: string }) {
  const t = useTranslations("invite");
  const auth = useTranslations("auth");
  const errors = useTranslations("errors");
  const [state, action] = useActionState(acceptAsNewUser.bind(null, token), {} as FormState);

  return (
    <form action={action} className="mt-6 space-y-4">
      {state.error ? (
        <Notice tone="error">
          {errors(state.error)}{" "}
          {state.error === "account_exists" ? (
            <Link href={`/log-masuk?seterusnya=/jemput/${token}`} className="font-semibold underline">
              {t("signInFirst")}
            </Link>
          ) : null}
        </Notice>
      ) : null}
      <Field label={auth("fullName")}>
        <TextInput name="fullName" autoComplete="name" required />
      </Field>
      <Field label={auth("password")} hint={auth("passwordHint")}>
        <TextInput name="password" type="password" autoComplete="new-password" minLength={8} required />
      </Field>
      <SubmitButton pendingLabel={t("accepting")} className="w-full">
        {t("accept")}
      </SubmitButton>
    </form>
  );
}

export function AcceptSignedInForm({ token }: { token: string }) {
  const t = useTranslations("invite");
  const errors = useTranslations("errors");
  const [state, action] = useActionState(acceptSignedIn.bind(null, token), {} as FormState);

  return (
    <form action={action} className="mt-6 space-y-4">
      {state.error ? <Notice tone="error">{errors(state.error)}</Notice> : null}
      <SubmitButton pendingLabel={t("accepting")} className="w-full">
        {t("accept")}
      </SubmitButton>
    </form>
  );
}
