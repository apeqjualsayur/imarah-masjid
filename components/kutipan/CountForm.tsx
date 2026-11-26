"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Field, Notice, SelectInput, TextArea, TextInput, Button } from "@/components/ui/forms";
import { submitCount } from "@/app/(app)/kewangan/kutipan/actions";
import { NOTE_MAX } from "@/lib/cashbook";
import { isNetworkFailure, type Breakdown, type QueuedCount } from "@/lib/collections";
import { AmountField } from "./AmountField";
import { forget, keepOnPhone } from "./queue";

type Fund = { id: string; name: string };

/**
 * The Friday count, made for a phone. With no signal the count is kept on the
 * phone and sent later; its key, made when the form opens, stops it being
 * saved twice.
 */
export function CountForm({ userId, funds, defaultFundId, today }: { userId: string; funds: Fund[]; defaultFundId: string; today: string }) {
  const t = useTranslations("kutipan");
  const errors = useTranslations("errors");
  const router = useRouter();
  const [key, setKey] = useState(() => crypto.randomUUID());
  const [error, setError] = useState<string | null>(null);
  const [keptOffline, setKeptOffline] = useState(false);
  const [pending, startTransition] = useTransition();

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const totalSen = Number(form.get("total_sen"));
    if (!form.get("total_sen") || !Number.isSafeInteger(totalSen) || totalSen <= 0) {
      setError(errors("amount_missing"));
      return;
    }
    const breakdownText = String(form.get("breakdown") ?? "");
    const fundId = String(form.get("fund_id") ?? "");
    const item: QueuedCount = {
      key,
      date: String(form.get("date") ?? ""),
      fund_id: fundId,
      fund_name: funds.find((fund) => fund.id === fundId)?.name ?? "",
      total_sen: totalSen,
      breakdown: breakdownText ? (JSON.parse(breakdownText) as Breakdown) : null,
      note: String(form.get("note") ?? "").trim(),
      saved_at: new Date().toISOString(),
    };
    const formElement = event.currentTarget;

    const keepForLater = () => {
      if (!keepOnPhone(userId, item)) {
        setError(errors("offline_not_kept"));
        return;
      }
      setError(null);
      setKeptOffline(true);
      formElement.reset();
      setKey(crypto.randomUUID());
    };

    setKeptOffline(false);
    if (navigator.onLine === false) {
      keepForLater();
      return;
    }

    startTransition(async () => {
      try {
        const result = await submitCount(item);
        if (result.ok) {
          forget(userId, item.key);
          router.push(`/kewangan/kutipan/${result.id}?hasil=dikira`);
        } else {
          setError(errors(result.error));
        }
      } catch (failure) {
        if (isNetworkFailure(failure)) keepForLater();
        else setError(errors("generic"));
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="mt-5 space-y-4" key={key}>
      {error ? <Notice tone="error">{error}</Notice> : null}
      {keptOffline ? <Notice tone="success">{t("keptOffline")}</Notice> : null}

      <AmountField label={t("amount")} autoFocus />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("date")}>
          <TextInput name="date" type="date" required max={today} defaultValue={today} />
        </Field>
        <Field label={t("fund")}>
          <SelectInput name="fund_id" required defaultValue={defaultFundId}>
            {funds.map((fund) => (
              <option key={fund.id} value={fund.id}>
                {fund.name}
              </option>
            ))}
          </SelectInput>
        </Field>
      </div>

      <Field label={t("note")} hint={t("noteHint")}>
        <TextArea name="note" rows={2} maxLength={NOTE_MAX} />
      </Field>

      <Button type="submit" disabled={pending} aria-busy={pending} className="w-full sm:w-auto">
        {pending ? t("saving") : t("save")}
      </Button>
    </form>
  );
}
