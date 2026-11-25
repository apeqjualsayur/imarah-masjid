"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Notice, SubmitButton } from "@/components/ui/forms";
import type { KariahState } from "@/app/(app)/kariah/actions";

/** A delete button that asks first and shows a plain error if it fails. */
export function DeleteButton({
  action,
  label,
  confirmText,
}: {
  action: () => Promise<KariahState>;
  label: string;
  confirmText: string;
}) {
  const t = useTranslations("kariah");
  const errors = useTranslations("errors");
  const [state, formAction] = useActionState(action, {} as KariahState);

  return (
    <form
      action={formAction}
      onSubmit={(event) => {
        if (!window.confirm(confirmText)) event.preventDefault();
      }}
      className="space-y-2"
    >
      <SubmitButton variant="secondary" pendingLabel={t("deleting")}>
        {label}
      </SubmitButton>
      {state.error ? <Notice tone="error">{errors(state.error)}</Notice> : null}
    </form>
  );
}
