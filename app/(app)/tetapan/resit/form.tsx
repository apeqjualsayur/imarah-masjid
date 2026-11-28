"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Notice, SubmitButton } from "@/components/ui/forms";
import { saveReceiptCredit, type CreditState } from "./actions";

export function CreditForm({ hidden }: { hidden: boolean }) {
  const t = useTranslations("resitTetapan");
  const errors = useTranslations("errors");
  const [state, action] = useActionState(saveReceiptCredit, {} as CreditState);

  return (
    <form action={action} className="mt-3 space-y-3">
      {state.error ? <Notice tone="error">{errors(state.error)}</Notice> : null}
      {state.saved ? <Notice tone="success">{t("saved")}</Notice> : null}
      <label className="flex min-h-tap cursor-pointer items-center gap-3">
        <input type="checkbox" name="hide_credit" defaultChecked={hidden} className="size-5 accent-primary" />
        <span>{t("hideCredit")}</span>
      </label>
      <SubmitButton pendingLabel={t("saving")}>{t("save")}</SubmitButton>
    </form>
  );
}
