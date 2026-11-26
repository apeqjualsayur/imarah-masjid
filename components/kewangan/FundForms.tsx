"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Button, Notice, SubmitButton, TextInput } from "@/components/ui/forms";
import {
  addCategory,
  addFund,
  renameCategory,
  setCategoryArchived,
  setFundArchived,
  updateFund,
  type FundState,
} from "@/app/(app)/tetapan/dana/actions";
import { FUND_NAME_MAX } from "@/lib/cashbook";
import { formatSen } from "@/lib/money";

function Message({ state }: { state: FundState }) {
  const t = useTranslations("dana");
  const errors = useTranslations("errors");
  if (state.error) return <Notice tone="error">{errors(state.error, { limit: state.limit ?? 0 })}</Notice>;
  if (state.done) return <Notice tone="success">{t("saved")}</Notice>;
  return null;
}

function RestrictedBox({ defaultChecked }: { defaultChecked: boolean }) {
  const t = useTranslations("dana");
  return (
    <label className="flex min-h-tap items-center gap-2 text-sm">
      <input type="checkbox" name="restricted" defaultChecked={defaultChecked} className="size-5 accent-primary" />
      <span>{t("restricted")}</span>
    </label>
  );
}

/** One fund: rename, mark restricted, archive or bring back. */
export function FundRow({
  fund,
}: {
  fund: { id: string; name: string; restricted: boolean; archived_at: string | null; closing_sen: number };
}) {
  const t = useTranslations("dana");
  const [state, action] = useActionState(updateFund.bind(null, fund.id), {} as FundState);
  const [archiveState, archive] = useActionState(setFundArchived.bind(null, fund.id, !fund.archived_at), {} as FundState);
  const archived = !!fund.archived_at;

  return (
    <li className="space-y-2 px-4 py-4">
      <form action={action} key={state.n ?? 0} className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <label className="min-w-0 flex-1 basis-56">
          <span className="sr-only">{t("nameFor", { name: fund.name })}</span>
          <TextInput name="name" defaultValue={fund.name} maxLength={FUND_NAME_MAX} required disabled={archived} className="mt-0" />
        </label>
        <span className="text-sm text-muted tabular-nums">{t("balance", { amount: formatSen(fund.closing_sen) })}</span>
        {!archived ? (
          <>
            <RestrictedBox defaultChecked={fund.restricted} />
            <SubmitButton variant="secondary" pendingLabel={t("saving")}>
              {t("save")}
            </SubmitButton>
          </>
        ) : null}
      </form>
      <form action={archive} className="flex flex-wrap items-center gap-3">
        {archived || fund.closing_sen === 0 ? (
          <Button type="submit" variant="quiet" className="px-0">
            {archived ? t("unarchive") : t("archive")}
          </Button>
        ) : (
          <span className="text-sm text-muted">{t("archiveNeedsZero")}</span>
        )}
      </form>
      <Message state={state} />
      <Message state={archiveState} />
    </li>
  );
}

export function AddFundForm() {
  const t = useTranslations("dana");
  const [state, action] = useActionState(addFund, {} as FundState);
  return (
    <form action={action} key={state.n ?? 0} className="space-y-2 px-4 py-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <label className="min-w-0 flex-1 basis-56">
          <span className="sr-only">{t("newFund")}</span>
          <TextInput name="name" placeholder={t("newFundPlaceholder")} maxLength={FUND_NAME_MAX} required className="mt-0" />
        </label>
        <RestrictedBox defaultChecked={false} />
        <SubmitButton pendingLabel={t("saving")}>{t("addFund")}</SubmitButton>
      </div>
      <Message state={state} />
    </form>
  );
}

export function CategoryRow({ category }: { category: { id: string; name: string; archived_at: string | null } }) {
  const t = useTranslations("dana");
  const [state, action] = useActionState(renameCategory.bind(null, category.id), {} as FundState);
  const [archiveState, archive] = useActionState(
    setCategoryArchived.bind(null, category.id, !category.archived_at),
    {} as FundState,
  );
  const archived = !!category.archived_at;

  return (
    <li className="space-y-2 px-4 py-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <form action={action} key={state.n ?? 0} className="flex min-w-0 flex-1 basis-64 items-center gap-2">
          <label className="min-w-0 flex-1">
            <span className="sr-only">{t("nameFor", { name: category.name })}</span>
            <TextInput name="name" defaultValue={category.name} maxLength={FUND_NAME_MAX} required disabled={archived} className="mt-0" />
          </label>
          {!archived ? (
            <SubmitButton variant="secondary" pendingLabel={t("saving")}>
              {t("save")}
            </SubmitButton>
          ) : null}
        </form>
        <form action={archive}>
          <Button type="submit" variant="quiet" className="px-0">
            {archived ? t("unarchive") : t("archive")}
          </Button>
        </form>
      </div>
      <Message state={state} />
      <Message state={archiveState} />
    </li>
  );
}

export function AddCategoryForm({ type }: { type: "income" | "expense" }) {
  const t = useTranslations("dana");
  const [state, action] = useActionState(addCategory, {} as FundState);
  return (
    <form action={action} key={state.n ?? 0} className="space-y-2 px-4 py-3">
      <input type="hidden" name="type" value={type} />
      <div className="flex items-center gap-2">
        <label className="min-w-0 flex-1">
          <span className="sr-only">{type === "income" ? t("newIncome") : t("newExpense")}</span>
          <TextInput name="name" placeholder={t("newCategoryPlaceholder")} maxLength={FUND_NAME_MAX} required className="mt-0" />
        </label>
        <SubmitButton pendingLabel={t("saving")}>{t("add")}</SubmitButton>
      </div>
      <Message state={state} />
    </form>
  );
}
