import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { BackLink } from "@/components/BackLink";
import { Badge, SignedAmount } from "@/components/kewangan/bits";
import { ReverseForm } from "@/components/kewangan/ReverseForm";
import { ATTACHMENT_BUCKET, ATTACHMENT_LINK_SECONDS } from "@/lib/attachment";
import { formatDate, formatDay } from "@/lib/dates";
import { can } from "@/lib/permissions";
import { requireMember } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { loadCategories, loadFunds, loadMemberNames, TRANSACTION_COLUMNS, type Transaction } from "../data";

export default async function TransactionPage({ params }: PageProps<"/kewangan/[id]">) {
  const { role } = await requireMember("finance.view");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const supabase = await createClient();
  const { data } = await supabase.from("transactions").select(TRANSACTION_COLUMNS).eq("id", id).maybeSingle();
  if (!data) notFound();
  const entry = data as Transaction;

  const [funds, categories, names, t, k, locale] = await Promise.all([
    loadFunds(),
    loadCategories(),
    loadMemberNames(),
    getTranslations("transaksi"),
    getTranslations("kewangan"),
    getLocale(),
  ]);

  // The other half of a cancellation, either way round.
  const { data: link } = entry.reverses_id
    ? await supabase.from("transactions").select(TRANSACTION_COLUMNS).eq("id", entry.reverses_id).maybeSingle()
    : await supabase.from("transactions").select(TRANSACTION_COLUMNS).eq("reverses_id", entry.id).maybeSingle();
  const other = (link as Transaction | null) ?? null;
  const cancelledBy = entry.reverses_id ? null : other;

  const { data: fromCollection } = await supabase.from("collections").select("id").eq("transaction_id", entry.id).maybeSingle();

  let attachmentUrl: string | null = null;
  if (entry.attachment_path) {
    const { data: signed } = await supabase.storage.from(ATTACHMENT_BUCKET).createSignedUrl(entry.attachment_path, ATTACHMENT_LINK_SECONDS);
    attachmentUrl = signed?.signedUrl ?? null;
  }

  const fund = funds.find((item) => item.id === entry.fund_id);
  const category = categories.find((item) => item.id === entry.category_id);
  const who = (userId: string | null) => (userId ? (names.get(userId) ?? "—") : "—");
  const canReverse = can(role, "transactions.reverse") && !entry.reverses_id && !cancelledBy;

  return (
    <>
      <BackLink href={`/kewangan?bulan=${entry.date.slice(0, 7)}`} label={k("title")} />
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-3xl font-bold tracking-tight">{category?.name ?? k("noCategory")}</h1>
        {cancelledBy ? <Badge tone="warn">{k("cancelled")}</Badge> : null}
        {entry.reverses_id ? <Badge tone="plain">{k("reversal")}</Badge> : null}
      </div>
      <p className="mt-2 text-2xl">
        <SignedAmount sen={entry.amount_sen} direction={entry.direction} className={cancelledBy ? "line-through opacity-70" : ""} />
      </p>

      <section aria-label={t("details")} className="mt-5 rounded-card bg-surface p-5">
        <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-[10rem_1fr]">
          <dt className="text-sm text-muted">{t("type")}</dt>
          <dd>{entry.direction === "in" ? t("receipt") : t("payment")}</dd>
          <dt className="text-sm text-muted">{t("date")}</dt>
          <dd>{formatDay(entry.date, locale)}</dd>
          <dt className="text-sm text-muted">{k("fund")}</dt>
          <dd className="flex flex-wrap items-center gap-2">
            {fund?.name ?? "—"}
            {fund?.restricted ? <Badge tone="gold">{k("restricted")}</Badge> : null}
          </dd>
          <dt className="text-sm text-muted">{t("method")}</dt>
          <dd>{k(`methods.${entry.method}`)}</dd>
          {entry.receipt_no ? (
            <>
              <dt className="text-sm text-muted">{t("receiptNo")}</dt>
              <dd className="font-semibold">{entry.receipt_no}</dd>
            </>
          ) : null}
          <dt className="text-sm text-muted">{t("ref")}</dt>
          <dd>{entry.ref_no || "—"}</dd>
          <dt className="text-sm text-muted">{t("note")}</dt>
          <dd className="whitespace-pre-line">{entry.note || "—"}</dd>
          <dt className="text-sm text-muted">{t("attachment")}</dt>
          <dd>
            {attachmentUrl ? (
              <a
                href={attachmentUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-tap items-center gap-1 font-semibold text-primary-dark underline underline-offset-4"
              >
                {t("openAttachment")}
                <ExternalLink aria-hidden className="size-4" />
              </a>
            ) : entry.attachment_path ? (
              t("attachmentMissing")
            ) : (
              "—"
            )}
          </dd>
          {fromCollection ? (
            <>
              <dt className="text-sm text-muted">{t("source")}</dt>
              <dd>
                <Link href={`/kewangan/kutipan/${fromCollection.id}`} className="font-semibold text-primary-dark underline underline-offset-4">
                  {t("fromCollection")}
                </Link>
              </dd>
            </>
          ) : null}
          <dt className="text-sm text-muted">{t("recordedBy")}</dt>
          <dd>{t("byOn", { name: who(entry.created_by), date: formatDate(entry.created_at, locale) })}</dd>
        </dl>
      </section>

      {entry.reverses_id ? (
        <section className="mt-5 rounded-card bg-surface p-5">
          <h2 className="text-lg font-bold">{t("thisCancels")}</h2>
          <p className="mt-1">{t("reasonShown", { reason: entry.reversal_reason ?? "—" })}</p>
          {other ? (
            <Link href={`/kewangan/${other.id}`} className="mt-2 inline-flex min-h-tap items-center font-semibold text-primary-dark underline underline-offset-4">
              {t("openOriginal", { date: formatDay(other.date, locale) })}
            </Link>
          ) : null}
        </section>
      ) : null}

      {cancelledBy ? (
        <section className="mt-5 rounded-card bg-warn-bg p-5 text-warn-ink">
          <h2 className="text-lg font-bold">{t("cancelledTitle")}</h2>
          <p className="mt-1">
            {t("cancelledLine", { name: who(cancelledBy.created_by), date: formatDay(cancelledBy.date, locale) })}
          </p>
          <p className="mt-1">{t("reasonShown", { reason: cancelledBy.reversal_reason ?? "—" })}</p>
          <Link href={`/kewangan/${cancelledBy.id}`} className="mt-2 inline-flex min-h-tap items-center font-semibold underline underline-offset-4">
            {t("openReversal")}
          </Link>
        </section>
      ) : null}

      {canReverse ? (
        <section aria-labelledby="batal" className="mt-8 border-t border-rule pt-5">
          <h2 id="batal" className="text-lg font-bold">
            {t("cancelTitle")}
          </h2>
          <p className="mt-1 text-sm text-muted">{t("cancelLead")}</p>
          <ReverseForm id={entry.id} canRecord={can(role, "transactions.record")} />
        </section>
      ) : null}
    </>
  );
}
