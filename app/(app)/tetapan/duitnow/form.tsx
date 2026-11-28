"use client";

import { startTransition, useActionState, useState, type ChangeEvent, type FormEvent } from "react";
import jsQR from "jsqr";
import { useTranslations } from "next-intl";
import { Button, Field, Notice, SubmitButton, TextArea } from "@/components/ui/forms";
import { checkDuitNow } from "@/lib/duitnow";
import { removeDuitNow, saveDuitNow, saveReceiptQr, type DuitNowState } from "./actions";

/** Reads the QR in a picture, in the browser. Big phone photos are scaled down first. */
async function readQrImage(file: File): Promise<string | null> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const context = canvas.getContext("2d");
  if (!context) return null;
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const image = context.getImageData(0, 0, canvas.width, canvas.height);
  return jsQR(image.data, image.width, image.height, { inversionAttempts: "attemptBoth" })?.data ?? null;
}

export function DuitNowForm({ current }: { current: string | null }) {
  const t = useTranslations("duitnow");
  const errors = useTranslations("errors");
  const [state, action, saving] = useActionState(saveDuitNow, {} as DuitNowState);
  const [payload, setPayload] = useState(current ?? "");

  // Sent by hand so the pasted text stays in the box if it is refused.
  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    startTransition(() => action(form));
  }
  const [reading, setReading] = useState<"idle" | "busy" | "failed">("idle");
  const check = payload.trim() ? checkDuitNow(payload) : null;
  const changed = payload.trim() !== (current ?? "");

  async function onFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setReading("busy");
    try {
      const text = await readQrImage(file);
      if (text) {
        setPayload(text);
        setReading("idle");
      } else setReading("failed");
    } catch {
      setReading("failed");
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-3 space-y-4">
      {state.error ? <Notice tone="error">{errors(state.error)}</Notice> : null}
      {state.saved === "qr" && !changed ? <Notice tone="success">{t("saved")}</Notice> : null}

      <Field label={t("upload")} hint={t("uploadHint")}>
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={onFile}
          className="block min-h-tap w-full text-sm file:mr-3 file:min-h-tap file:rounded-chip file:border-0 file:bg-tint file:px-4 file:font-semibold file:text-primary-dark"
        />
      </Field>
      {reading === "busy" ? <p className="text-sm text-muted">{t("reading")}</p> : null}
      {reading === "failed" ? <Notice tone="error">{t("readFailed")}</Notice> : null}

      <Field label={t("payload")} hint={t("payloadHint")}>
        <TextArea name="payload" rows={3} value={payload} onChange={(event) => setPayload(event.target.value)} spellCheck={false} className="font-mono text-sm" />
      </Field>

      {check && !check.ok ? <Notice tone="error">{errors(check.error)}</Notice> : null}
      {check?.ok && changed ? (
        <div className="rounded-card bg-tint p-4" data-testid="duitnow-semak">
          <p className="text-sm text-muted">{t("nameInQr")}</p>
          <p className="text-lg font-bold">{check.name ?? t("noName")}</p>
          {check.city ? <p className="text-sm text-muted">{check.city}</p> : null}
          <label className="mt-3 flex min-h-tap cursor-pointer items-center gap-3">
            <input type="checkbox" name="confirm" required className="size-5 accent-primary" />
            <span className="font-medium">{t("confirm")}</span>
          </label>
        </div>
      ) : null}

      {changed ? (
        <Button type="submit" disabled={!check?.ok || saving} aria-busy={saving}>
          {saving ? t("saving") : t("save")}
        </Button>
      ) : null}
    </form>
  );
}

export function RemoveDuitNow() {
  const t = useTranslations("duitnow");
  const errors = useTranslations("errors");
  const [state, action] = useActionState(removeDuitNow, {} as DuitNowState);
  return (
    <form
      action={action}
      onSubmit={(event) => {
        if (!window.confirm(t("removeConfirm"))) event.preventDefault();
      }}
      className="mt-3 space-y-2"
    >
      {state.error ? <Notice tone="error">{errors(state.error)}</Notice> : null}
      <SubmitButton variant="secondary" pendingLabel={t("saving")}>
        {t("remove")}
      </SubmitButton>
    </form>
  );
}

export function ReceiptQrForm({ shown }: { shown: boolean }) {
  const t = useTranslations("duitnow");
  const errors = useTranslations("errors");
  const [state, action] = useActionState(saveReceiptQr, {} as DuitNowState);
  return (
    <form action={action} className="mt-3 space-y-3">
      {state.error ? <Notice tone="error">{errors(state.error)}</Notice> : null}
      {state.saved === "receipt" ? <Notice tone="success">{t("savedReceipt")}</Notice> : null}
      <label className="flex min-h-tap cursor-pointer items-center gap-3">
        <input type="checkbox" name="show_qr" defaultChecked={shown} className="size-5 accent-primary" />
        <span>{t("showOnReceipts")}</span>
      </label>
      <SubmitButton pendingLabel={t("saving")}>{t("saveReceipt")}</SubmitButton>
    </form>
  );
}
