"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Field, Notice, SubmitButton, TextInput } from "@/components/ui/forms";
import { startEnrolment, verifyCode, type AdminState, type EnrolState } from "../actions";

export function CodeForm({ factorId }: { factorId: string }) {
  const t = useTranslations("admin");
  const errors = useTranslations("errors");
  const [state, action] = useActionState(verifyCode.bind(null, factorId), {} as AdminState);

  return (
    <form action={action} className="mt-6 space-y-4">
      {state.error ? <Notice tone="error">{errors(state.error)}</Notice> : null}
      <Field label={t("code")}>
        <TextInput
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9 ]{6,7}"
          maxLength={7}
          required
        />
      </Field>
      <SubmitButton pendingLabel={t("checking")} className="w-full">
        {t("verify")}
      </SubmitButton>
    </form>
  );
}

export function EnrolForm() {
  const t = useTranslations("admin");
  const errors = useTranslations("errors");
  const [state, action] = useActionState(startEnrolment, {} as EnrolState);

  if (!state.factorId) {
    return (
      <form action={action} className="mt-6 space-y-4">
        {state.error ? <Notice tone="error">{errors(state.error)}</Notice> : null}
        <SubmitButton pendingLabel={t("checking")} className="w-full">
          {t("startEnrol")}
        </SubmitButton>
      </form>
    );
  }

  return (
    <div className="mt-6 space-y-4">
      <ol className="list-decimal space-y-1 pl-5 text-sm">
        <li>{t("enrolStep1")}</li>
        <li>{t("enrolStep2")}</li>
        <li>{t("enrolStep3")}</li>
      </ol>
      {/* eslint-disable-next-line @next/next/no-img-element -- a one-off data URL from Supabase */}
      <img src={state.qr} alt={t("qrAlt")} className="mx-auto size-48 rounded-chip border border-border bg-surface p-2" />
      <p className="text-sm text-muted">
        {t("secretLabel")} <code className="font-semibold break-all text-ink">{state.secret}</code>
      </p>
      <CodeForm factorId={state.factorId} />
    </div>
  );
}
