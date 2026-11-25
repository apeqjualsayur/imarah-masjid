"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { Notice, SubmitButton } from "@/components/ui/forms";
import { LOGO_MAX_BYTES } from "@/lib/logo";
import { removeLogo, uploadLogo, type LogoState } from "./actions";

export function LogoForms({ hasLogo }: { hasLogo: boolean }) {
  const t = useTranslations("logo");
  const errors = useTranslations("errors");
  const [uploadState, uploadAction] = useActionState(uploadLogo, {} as LogoState);
  const [removeState, removeAction] = useActionState(removeLogo, {} as LogoState);
  const [tooBig, setTooBig] = useState(false);

  const state = removeState.done || removeState.error ? removeState : uploadState;
  const error = tooBig ? "logo_too_big" : state.error;

  return (
    <div className="mt-4 space-y-4">
      {error ? <Notice tone="error">{errors(error)}</Notice> : null}
      {!error && state.done ? <Notice tone="success">{t(state.done)}</Notice> : null}

      <form action={uploadAction} className="space-y-4">
        <label className="block">
          <span className="font-semibold">{t("file")}</span>
          <input
            type="file"
            name="logo"
            accept="image/png,image/svg+xml,.png,.svg"
            required
            onChange={(event) => setTooBig((event.target.files?.[0]?.size ?? 0) > LOGO_MAX_BYTES)}
            className="mt-1.5 block min-h-tap w-full rounded-chip border border-border bg-surface px-3 py-2.5 text-sm file:mr-3 file:min-h-9 file:rounded-chip file:border-0 file:bg-tint file:px-4 file:font-semibold file:text-primary-dark"
          />
          <span className="mt-1 block text-sm text-muted">{t("fileHint")}</span>
        </label>
        <SubmitButton pendingLabel={t("uploading")} disabled={tooBig}>
          {t("upload")}
        </SubmitButton>
      </form>

      {hasLogo ? (
        <form
          action={removeAction}
          onSubmit={(event) => {
            if (!window.confirm(t("confirmRemove"))) event.preventDefault();
          }}
        >
          <SubmitButton variant="secondary" pendingLabel={t("removing")}>
            {t("remove")}
          </SubmitButton>
        </form>
      ) : null}
    </div>
  );
}
