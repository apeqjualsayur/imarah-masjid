"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { Field, Notice, SelectInput, SubmitButton, TextArea, TextInput } from "@/components/ui/forms";
import { isState, PRAYER_ZONES, STATES } from "@/lib/malaysia";
import { createMasjid, type FormState } from "../actions";

export function CreateMasjidForm() {
  const t = useTranslations("onboarding");
  const errors = useTranslations("errors");
  const [state, action] = useActionState(createMasjid, {} as FormState);
  const [chosenState, setChosenState] = useState("");
  const zones = isState(chosenState) ? PRAYER_ZONES[chosenState] : [];

  return (
    <form action={action} className="mt-6 space-y-4">
      {state.error ? <Notice tone="error">{errors(state.error)}</Notice> : null}
      <Field label={t("name")} hint={t("nameHint")}>
        <TextInput name="name" required maxLength={120} />
      </Field>
      <Field label={t("state")}>
        <SelectInput name="state" required value={chosenState} onChange={(e) => setChosenState(e.target.value)}>
          <option value="" disabled>
            {t("chooseState")}
          </option>
          {STATES.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </SelectInput>
      </Field>
      <Field label={t("address")}>
        <TextArea name="address" rows={3} maxLength={300} />
      </Field>
      <Field label={t("zone")} hint={t("zoneHint")}>
        <SelectInput name="zone" required defaultValue="" key={chosenState} disabled={zones.length === 0}>
          <option value="" disabled>
            {t("chooseZone")}
          </option>
          {zones.map((zone) => (
            <option key={zone.code} value={zone.code}>
              {zone.code}: {zone.areas}
            </option>
          ))}
        </SelectInput>
      </Field>
      <SubmitButton pendingLabel={t("submitting")} className="w-full">
        {t("submit")}
      </SubmitButton>
    </form>
  );
}
