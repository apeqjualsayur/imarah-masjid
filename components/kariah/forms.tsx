"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { Field, Notice, SelectInput, SubmitButton, TextArea, TextInput } from "@/components/ui/forms";
import { saveHousehold, saveMember, type KariahState } from "@/app/(app)/kariah/actions";
import { ADDRESS_MAX, NAME_MAX, RELATIONS } from "@/lib/kariah";

type Household = {
  id: string;
  head_name: string;
  address: string | null;
  phone: string | null;
  whatsapp_opt_in: boolean;
  pdpa_consent_at: string | null;
};

function ErrorNotice({ state }: { state: KariahState }) {
  const errors = useTranslations("errors");
  if (!state.error) return null;
  return <Notice tone="error">{errors(state.error, { limit: state.limit ?? 0 })}</Notice>;
}

function ConsentBox({ name, defaultChecked, label, text }: { name: string; defaultChecked: boolean; label: string; text: string }) {
  return (
    <label className="flex min-h-tap gap-3 rounded-chip border border-border p-3">
      <input type="checkbox" name={name} defaultChecked={defaultChecked} className="mt-1 size-5 shrink-0 accent-primary" />
      <span>
        <span className="block font-semibold">{label}</span>
        <span className="mt-0.5 block text-sm text-muted">{text}</span>
      </span>
    </label>
  );
}

export function HouseholdForm({ household }: { household?: Household }) {
  const t = useTranslations("kariah");
  const [state, action] = useActionState(saveHousehold.bind(null, household?.id ?? null), {} as KariahState);

  return (
    <form action={action} className="mt-6 space-y-4">
      <ErrorNotice state={state} />
      <Field label={t("headName")}>
        <TextInput name="head_name" required maxLength={NAME_MAX} defaultValue={household?.head_name} autoComplete="off" />
      </Field>
      <Field label={t("address")}>
        <TextArea name="address" rows={3} maxLength={ADDRESS_MAX} defaultValue={household?.address ?? ""} />
      </Field>
      <Field label={t("phone")} hint={t("phoneHint")}>
        <TextInput name="phone" type="tel" inputMode="tel" defaultValue={household?.phone ?? ""} autoComplete="off" />
      </Field>

      <fieldset className="space-y-3">
        <legend className="font-semibold">{t("consentTitle")}</legend>
        <ConsentBox
          name="whatsapp"
          defaultChecked={household?.whatsapp_opt_in ?? false}
          label={t("consent.whatsappLabel")}
          text={t("consent.whatsappText")}
        />
        <ConsentBox
          name="pdpa"
          defaultChecked={!!household?.pdpa_consent_at}
          label={t("consent.pdpaLabel")}
          text={t("consent.pdpaText")}
        />
        <p className="text-sm text-muted">{t("consentDateNote")}</p>
      </fieldset>

      <SubmitButton pendingLabel={t("saving")}>{t("save")}</SubmitButton>
    </form>
  );
}

type Member = {
  id: string;
  name: string;
  relation: string | null;
  date_of_birth: string | null;
  ic_last4: string | null;
};

export function MemberForm({ householdId, member }: { householdId: string; member?: Member }) {
  const t = useTranslations("kariah");
  const [state, action] = useActionState(saveMember.bind(null, householdId, member?.id ?? null), {} as KariahState);
  const [ic, setIc] = useState(member?.ic_last4 ?? "");
  const [trimmed, setTrimmed] = useState(false);

  // A full IC typed or pasted is cut to its last 4 digits before it leaves the device.
  function onIcChange(value: string) {
    const digits = value.replace(/\D/g, "");
    setTrimmed(digits.length > 4);
    setIc(digits.slice(-4));
  }

  return (
    <form action={action} className="mt-6 space-y-4">
      <ErrorNotice state={state} />
      <Field label={t("memberName")}>
        <TextInput name="name" required maxLength={NAME_MAX} defaultValue={member?.name} autoComplete="off" />
      </Field>
      <Field label={t("relation")}>
        <SelectInput name="relation" defaultValue={member?.relation ?? ""}>
          <option value="">{t("relationNone")}</option>
          {RELATIONS.map((relation) => (
            <option key={relation} value={relation}>
              {t(`relations.${relation}`)}
            </option>
          ))}
        </SelectInput>
      </Field>
      <Field label={t("dateOfBirth")}>
        <TextInput name="date_of_birth" type="date" defaultValue={member?.date_of_birth ?? ""} />
      </Field>
      <Field label={t("icLast4")} hint={t("icNote")}>
        <TextInput
          name="ic_last4"
          inputMode="numeric"
          autoComplete="off"
          value={ic}
          onChange={(event) => onIcChange(event.target.value)}
          className="max-w-40"
        />
      </Field>
      {trimmed ? <Notice tone="success">{t("icTrimmed")}</Notice> : null}
      <SubmitButton pendingLabel={t("saving")}>{t("save")}</SubmitButton>
    </form>
  );
}
