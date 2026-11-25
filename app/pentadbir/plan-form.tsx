"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Notice, SelectInput, SubmitButton } from "@/components/ui/forms";
import { setPlan, type AdminState } from "./actions";

const PLANS = ["asas", "standard", "pro", "daerah_negeri"] as const;

export function PlanForm({ masjidId, masjidName, plan }: { masjidId: string; masjidName: string; plan: string }) {
  const t = useTranslations("admin");
  const plans = useTranslations("plans");
  const errors = useTranslations("errors");
  const [state, action] = useActionState(setPlan.bind(null, masjidId), {} as AdminState);

  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <label>
        <span className="sr-only">{t("planFor", { name: masjidName })}</span>
        <SelectInput name="plan" defaultValue={plan} className="mt-0 w-44">
          {PLANS.map((option) => (
            <option key={option} value={option}>
              {plans(option)}
            </option>
          ))}
        </SelectInput>
      </label>
      <SubmitButton variant="secondary" pendingLabel={t("saving")}>
        {t("savePlan")}
      </SubmitButton>
      {state.error ? <Notice tone="error">{errors(state.error)}</Notice> : null}
      {state.done ? <Notice tone="success">{t("planSaved")}</Notice> : null}
    </form>
  );
}
