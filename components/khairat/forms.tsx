"use client";

import { useActionState, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { RefreshCw } from "lucide-react";
import { Field, Notice, SelectInput, SubmitButton, TextArea, TextInput } from "@/components/ui/forms";
import {
  endMembership,
  enrolHouseholds,
  recordPayment,
  renewFromLastYear,
  savePlan,
  type EndState,
  type EnrolState,
  type PaymentState,
  type PaymentValues,
  type PlanState,
  type PlanValues,
} from "@/app/(app)/khairat/actions";
import { METHODS, RECEIVED_FROM_MAX, REF_MAX } from "@/lib/cashbook";
import { END_REASON_MAX } from "@/lib/khairat";

type FundOption = { id: string; name: string };

/** The yearly setup: fee, who is covered, last day to pay, fund. */
export function PlanForm({ id, initial, funds, yearFixed }: { id: string | null; initial: PlanValues; funds: FundOption[]; yearFixed: boolean }) {
  const errors = useTranslations("errors");
  const [state, action] = useActionState(savePlan, {} as PlanState);
  const values = state.values ?? initial;
  return <PlanFields key={state.n ?? 0} action={action} id={id} values={values} funds={funds} yearFixed={yearFixed} error={state.error ? errors(state.error) : null} />;
}

function PlanFields({
  action,
  id,
  values,
  funds,
  yearFixed,
  error,
}: {
  action: (form: FormData) => void;
  id: string | null;
  values: PlanValues;
  funds: FundOption[];
  yearFixed: boolean;
  error: string | null;
}) {
  const t = useTranslations("khairat");
  const [year, setYear] = useState(values.year);
  return (
    <form action={action} className="mt-5 max-w-xl space-y-4">
      {error ? <Notice tone="error">{error}</Notice> : null}
      {id ? <input type="hidden" name="id" value={id} /> : null}
      <Field label={t("year")}>
        <TextInput
          name="year"
          inputMode="numeric"
          required
          readOnly={yearFixed}
          defaultValue={values.year}
          onChange={(event) => setYear(event.target.value)}
          className={yearFixed ? "bg-background" : ""}
        />
      </Field>
      <Field label={t("fee")} hint={t("feeHint")}>
        <span className="relative block">
          <span aria-hidden className="pointer-events-none absolute top-1/2 left-4 mt-[0.1875rem] -translate-y-1/2 font-semibold text-muted">
            RM
          </span>
          <TextInput name="fee" inputMode="decimal" autoComplete="off" required defaultValue={values.fee} className="pl-12 tabular-nums" />
        </span>
      </Field>
      <fieldset>
        <legend className="font-semibold">{t("coverage")}</legend>
        <div className="mt-1.5 grid gap-2 sm:grid-cols-2">
          {(["household", "person"] as const).map((coverage) => (
            <label key={coverage} className="flex min-h-tap cursor-pointer items-start gap-3 rounded-chip border border-border bg-surface p-3">
              <input type="radio" name="coverage" value={coverage} required defaultChecked={values.coverage === coverage} className="mt-1 size-5 accent-primary" />
              <span>
                <span className="block font-semibold">{t(`coverages.${coverage}`)}</span>
                <span className="block text-sm text-muted">{t(`coverageHints.${coverage}`)}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <Field label={t("payBy")} hint={t("payByHint")}>
        <TextInput
          name="pay_by"
          type="date"
          required
          defaultValue={values.pay_by}
          min={/^\d{4}$/.test(year) ? `${year}-01-01` : undefined}
          max={/^\d{4}$/.test(year) ? `${year}-12-31` : undefined}
        />
      </Field>
      <Field label={t("fund")} hint={t("fundHint")}>
        <SelectInput name="fund_id" required defaultValue={values.fund_id}>
          <option value="">{t("chooseFund")}</option>
          {funds.map((fund) => (
            <option key={fund.id} value={fund.id}>
              {fund.name}
            </option>
          ))}
        </SelectInput>
      </Field>
      <SubmitButton pendingLabel={t("saving")}>{t("saveSetup")}</SubmitButton>
    </form>
  );
}

type HouseholdOption = { id: string; head_name: string; address: string | null };

/** Tick households to enrol for the year. */
export function EnrolForm({ year, households }: { year: number; households: HouseholdOption[] }) {
  const t = useTranslations("khairat");
  const errors = useTranslations("errors");
  const [state, action] = useActionState(enrolHouseholds.bind(null, year), {} as EnrolState);
  const [query, setQuery] = useState("");
  const [chosen, setChosen] = useState<Set<string>>(new Set());
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? households.filter((h) => `${h.head_name} ${h.address ?? ""}`.toLowerCase().includes(q)) : households;
  }, [households, query]);

  const toggle = (id: string, on: boolean) =>
    setChosen((current) => {
      const next = new Set(current);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  const allShown = shown.length > 0 && shown.every((h) => chosen.has(h.id));

  return (
    <form action={action} className="mt-5 space-y-4">
      {state.error ? <Notice tone="error">{errors(state.error)}</Notice> : null}
      <label className="block">
        <span className="font-semibold">{t("searchHousehold")}</span>
        <TextInput type="search" value={query} onChange={(event) => setQuery(event.target.value)} autoComplete="off" />
      </label>
      <label className="flex min-h-tap cursor-pointer items-center gap-3 font-semibold">
        <input
          type="checkbox"
          checked={allShown}
          onChange={(event) => shown.forEach((h) => toggle(h.id, event.target.checked))}
          className="size-5 accent-primary"
        />
        {t("chooseAll", { count: shown.length })}
      </label>
      <ul className="divide-y divide-rule rounded-card bg-surface">
        {shown.map((household) => (
          <li key={household.id}>
            <label className="flex min-h-tap cursor-pointer items-center gap-3 px-4 py-3">
              <input
                type="checkbox"
                name="household"
                value={household.id}
                checked={chosen.has(household.id)}
                onChange={(event) => toggle(household.id, event.target.checked)}
                className="size-5 accent-primary"
              />
              <span className="min-w-0">
                <span className="block font-semibold">{household.head_name}</span>
                {household.address ? <span className="block truncate text-sm text-muted">{household.address}</span> : null}
              </span>
            </label>
          </li>
        ))}
      </ul>
      {/* Ticked households hidden by the search are still sent. */}
      {[...chosen]
        .filter((id) => !shown.some((h) => h.id === id))
        .map((id) => (
          <input key={id} type="hidden" name="household" value={id} />
        ))}
      <SubmitButton pendingLabel={t("enrolling")} disabled={chosen.size === 0}>
        {t("enrolChosen", { count: chosen.size })}
      </SubmitButton>
    </form>
  );
}

/** Enrols last year's members again. */
export function RenewButton({ year }: { year: number }) {
  const t = useTranslations("khairat");
  const errors = useTranslations("errors");
  const [state, action] = useActionState(renewFromLastYear.bind(null, year), {} as EnrolState);
  return (
    <form action={action} className="inline">
      {state.error ? <Notice tone="error">{errors(state.error)}</Notice> : null}
      <SubmitButton variant="secondary" pendingLabel={t("enrolling")}>
        <RefreshCw aria-hidden className="size-4" />
        {t("renew", { year: year - 1 })}
      </SubmitButton>
    </form>
  );
}

/** Records a payment for one household's year. */
export function PaymentForm({ id, initial, headName }: { id: string; initial: PaymentValues; headName: string }) {
  const errors = useTranslations("errors");
  const [state, action] = useActionState(recordPayment.bind(null, id), {} as PaymentState);
  const values = state.values ?? initial;
  return <PaymentFields key={state.n ?? 0} action={action} values={values} headName={headName} error={state.error ? errors(state.error) : null} />;
}

function PaymentFields({
  action,
  values,
  headName,
  error,
}: {
  action: (form: FormData) => void;
  values: PaymentValues;
  headName: string;
  error: string | null;
}) {
  const t = useTranslations("khairat");
  const k = useTranslations("kewangan");
  return (
    <form action={action} className="mt-3 space-y-4">
      {error ? <Notice tone="error">{error}</Notice> : null}
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
          <TextInput name="date" type="date" required defaultValue={values.date} max={values.date} />
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
      <Field label={t("receivedFrom")} hint={t("receivedFromHint", { name: headName })}>
        <TextInput name="received_from" maxLength={RECEIVED_FROM_MAX} autoComplete="off" defaultValue={values.received_from} placeholder={headName} />
      </Field>
      <SubmitButton pendingLabel={t("saving")}>{t("recordPayment")}</SubmitButton>
    </form>
  );
}

/** Ends a membership with a reason. Asks once more before saving. */
export function EndForm({ id }: { id: string }) {
  const t = useTranslations("khairat");
  const errors = useTranslations("errors");
  const [state, action] = useActionState(endMembership.bind(null, id), {} as EndState);
  return (
    <form
      action={action}
      onSubmit={(event) => {
        if (!window.confirm(t("confirmEnd"))) event.preventDefault();
      }}
      className="mt-3 space-y-3"
    >
      {state.error ? <Notice tone="error">{errors(state.error)}</Notice> : null}
      <Field label={t("endReason")} hint={t("endReasonHint")}>
        <TextArea name="reason" rows={2} required maxLength={END_REASON_MAX} />
      </Field>
      <SubmitButton variant="secondary" pendingLabel={t("saving")}>
        {t("end")}
      </SubmitButton>
    </form>
  );
}
