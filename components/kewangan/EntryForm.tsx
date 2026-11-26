"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowDownLeft, ArrowUpRight, Paperclip } from "lucide-react";
import { Field, Notice, SelectInput, SubmitButton, TextArea, TextInput } from "@/components/ui/forms";
import { recordTransaction, type EntryState, type EntryValues } from "@/app/(app)/kewangan/actions";
import { ATTACHMENT_BUCKET, checkAttachment } from "@/lib/attachment";
import { METHODS, NOTE_MAX, REF_MAX } from "@/lib/cashbook";
import { createClient } from "@/lib/supabase/browser";

type Option = { id: string; name: string };
type CategoryOption = Option & { type: "income" | "expense" };

const valuesOf = (form: FormData): EntryValues => {
  const get = (name: string) => String(form.get(name) ?? "").trim();
  return {
    direction: get("direction"),
    date: get("date"),
    fund_id: get("fund_id"),
    category_id: get("category_id"),
    amount: get("amount"),
    method: get("method"),
    ref_no: get("ref_no"),
    note: get("note"),
  };
};

/**
 * The receipt or payment form. An attachment goes straight from the browser to
 * the masjid's own Storage folder (big phone photos are too large to pass
 * through a server function); the server then checks it again before saving.
 */
export function EntryForm({
  masjidId,
  funds,
  categories,
  initial,
  today,
}: {
  masjidId: string;
  funds: (Option & { restricted: boolean })[];
  categories: CategoryOption[];
  initial: EntryValues;
  today: string;
}) {
  const errors = useTranslations("errors");

  const [state, action] = useActionState(async (prev: EntryState, form: FormData): Promise<EntryState> => {
    const file = form.get("attachment");
    form.delete("attachment");
    if (file instanceof File && file.size > 0) {
      const refuse = (error: string) => ({ error, values: valuesOf(form), n: (prev.n ?? 0) + 1 });
      const bytes = new Uint8Array(await file.arrayBuffer());
      const check = checkAttachment(bytes);
      if (!check.ok) return refuse(check.error);
      const path = `masjids/${masjidId}/${crypto.randomUUID()}.${check.ext}`;
      const { error } = await createClient().storage.from(ATTACHMENT_BUCKET).upload(path, bytes, { contentType: check.contentType });
      if (error) return refuse("attachment_failed");
      form.set("attachment_path", path);
    }
    return recordTransaction(prev, form);
  }, {} as EntryState);

  const values = state.values ?? initial;

  return (
    <EntryFields
      key={state.n ?? 0}
      action={action}
      values={values}
      error={state.error ? errors(state.error) : null}
      funds={funds}
      categories={categories}
      today={today}
    />
  );
}

/** Remounted after each refusal, so the fields show what was typed. */
function EntryFields({
  action,
  values,
  error,
  funds,
  categories,
  today,
}: {
  action: (form: FormData) => void;
  values: EntryValues;
  error: string | null;
  funds: (Option & { restricted: boolean })[];
  categories: CategoryOption[];
  today: string;
}) {
  const t = useTranslations("rekod");
  const k = useTranslations("kewangan");
  const [direction, setDirection] = useState(values.direction === "out" ? "out" : values.direction === "in" ? "in" : "");
  const [categoryId, setCategoryId] = useState(values.category_id);
  const type = direction === "in" ? "income" : "expense";
  const choices = direction ? categories.filter((category) => category.type === type) : [];
  const category = choices.some((choice) => choice.id === categoryId) ? categoryId : "";

  const directionButton = (value: "in" | "out", label: string, hint: string, Icon: typeof ArrowDownLeft) => (
    <label
      className={`flex min-h-tap cursor-pointer items-center gap-3 rounded-chip border p-3 ${
        direction === value ? "border-primary bg-tint" : "border-border bg-surface"
      }`}
    >
      <input
        type="radio"
        name="direction"
        value={value}
        required
        checked={direction === value}
        onChange={() => setDirection(value)}
        className="size-5 accent-primary"
      />
      <Icon aria-hidden className="size-5 text-primary-dark" />
      <span>
        <span className="block font-semibold">{label}</span>
        <span className="block text-sm text-muted">{hint}</span>
      </span>
    </label>
  );

  return (
    <form action={action} className="mt-6 space-y-4">
      {error ? <Notice tone="error">{error}</Notice> : null}

      <fieldset>
        <legend className="font-semibold">{t("type")}</legend>
        <div className="mt-1.5 grid gap-2 sm:grid-cols-2">
          {directionButton("in", t("receipt"), t("receiptHint"), ArrowDownLeft)}
          {directionButton("out", t("payment"), t("paymentHint"), ArrowUpRight)}
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("amount")} hint={t("amountHint")}>
          <span className="relative block">
            <span aria-hidden className="pointer-events-none absolute top-1/2 left-4 mt-[0.1875rem] -translate-y-1/2 font-semibold text-muted">
              RM
            </span>
            <TextInput name="amount" inputMode="decimal" autoComplete="off" required defaultValue={values.amount} className="pl-12 tabular-nums" />
          </span>
        </Field>
        <Field label={t("date")}>
          <TextInput name="date" type="date" required max={today} defaultValue={values.date} />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={k("fund")}>
          <SelectInput name="fund_id" required defaultValue={values.fund_id}>
            <option value="">{t("chooseFund")}</option>
            {funds.map((fund) => (
              <option key={fund.id} value={fund.id}>
                {fund.restricted ? t("restrictedName", { name: fund.name }) : fund.name}
              </option>
            ))}
          </SelectInput>
        </Field>
        <Field label={k("category")} hint={direction ? undefined : t("categoryHint")}>
          <SelectInput name="category_id" required value={category} onChange={(event) => setCategoryId(event.target.value)} disabled={!direction}>
            <option value="">{t("chooseCategory")}</option>
            {choices.map((choice) => (
              <option key={choice.id} value={choice.id}>
                {choice.name}
              </option>
            ))}
          </SelectInput>
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("method")}>
          <SelectInput name="method" required defaultValue={values.method || "cash"}>
            {METHODS.map((method) => (
              <option key={method} value={method}>
                {k(`methods.${method}`)}
              </option>
            ))}
          </SelectInput>
        </Field>
        <Field label={t("ref")} hint={t("refHint")}>
          <TextInput name="ref_no" maxLength={REF_MAX} autoComplete="off" defaultValue={values.ref_no} />
        </Field>
      </div>

      <Field label={t("note")} hint={t("noteHint")}>
        <TextArea name="note" rows={2} maxLength={NOTE_MAX} defaultValue={values.note} />
      </Field>

      <Field label={t("attachment")} hint={t("attachmentHint")}>
        <span className="mt-1.5 flex items-center gap-2 rounded-chip border border-dashed border-border bg-surface px-4 py-3">
          <Paperclip aria-hidden className="size-4 shrink-0 text-muted" />
          <input name="attachment" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="min-w-0 flex-1 text-sm" />
        </span>
      </Field>

      <SubmitButton pendingLabel={t("saving")}>{t("save")}</SubmitButton>
    </form>
  );
}
