import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { BackLink } from "@/components/BackLink";
import { EntryForm } from "@/components/kewangan/EntryForm";
import { Notice } from "@/components/ui/forms";
import { todayInMalaysia } from "@/lib/cashbook";
import { senToPlain } from "@/lib/money";
import { can } from "@/lib/permissions";
import { requireMember } from "@/lib/session";
import { emailEnabled } from "@/lib/email";
import { createClient } from "@/lib/supabase/server";
import type { EntryValues } from "../actions";
import { isMonthLocked, loadCategories, loadFunds, TRANSACTION_COLUMNS, type Transaction } from "../data";

export default async function NewEntryPage({ searchParams }: PageProps<"/kewangan/baru">) {
  const { masjid, role } = await requireMember("transactions.record");
  const t = await getTranslations("rekod");
  const params = await searchParams;
  const today = todayInMalaysia();

  const [funds, categories] = await Promise.all([loadFunds(), loadCategories()]);
  const openFunds = funds.filter((fund) => !fund.archived_at);
  const openCategories = categories.filter((category) => !category.archived_at);

  // After a cancellation, start from the cancelled entry so only the mistake needs fixing.
  let original: Transaction | null = null;
  if (typeof params.dari === "string" && /^[0-9a-f-]{36}$/i.test(params.dari)) {
    const supabase = await createClient();
    const { data } = await supabase.from("transactions").select(TRANSACTION_COLUMNS).eq("id", params.dari).maybeSingle();
    original = (data as Transaction | null) ?? null;
  }

  const initial: EntryValues = original
    ? {
        direction: original.direction,
        date: (await isMonthLocked(original.date.slice(0, 7))) ? today : original.date,
        fund_id: openFunds.some((fund) => fund.id === original.fund_id) ? original.fund_id : "",
        category_id: original.category_id ?? "",
        amount: senToPlain(original.amount_sen),
        method: original.method,
        ref_no: original.ref_no ?? "",
        note: original.note ?? "",
        received_from: original.received_from ?? "",
        email: "",
      }
    : { direction: "", date: today, fund_id: "", category_id: "", amount: "", method: "cash", ref_no: "", note: "", received_from: "", email: "" };

  return (
    <>
      <BackLink href="/kewangan" label={t("back")} />
      <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
      <p className="mt-1 text-muted">{t("lead")}</p>

      {original ? (
        <div className="mt-4">
          <Notice tone="success">{t("fromCancelled")}</Notice>
        </div>
      ) : null}

      {openFunds.length === 0 ? (
        <p className="mt-6 rounded-card bg-surface p-6 text-muted">
          {t("noFunds")}{" "}
          {can(role, "funds.manage") ? (
            <Link href="/tetapan/dana" className="font-semibold text-primary-dark underline underline-offset-4">
              {t("toFunds")}
            </Link>
          ) : null}
        </p>
      ) : (
        <div className="max-w-2xl">
          <EntryForm
            masjidId={masjid.id}
            funds={openFunds}
            categories={openCategories}
            initial={initial}
            today={today}
            canEmail={emailEnabled()}
          />
        </div>
      )}
    </>
  );
}
