import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { BackLink } from "@/components/BackLink";
import { Badge } from "@/components/kewangan/bits";
import { CancelForm, ConfirmForm, RecountForm } from "@/components/kutipan/StepForms";
import { Notice } from "@/components/ui/forms";
import { NOTES } from "@/lib/collections";
import { formatDate, formatDay } from "@/lib/dates";
import { formatSen } from "@/lib/money";
import { can } from "@/lib/permissions";
import { requireMember } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { loadFunds, loadMemberNames } from "../../data";
import { amountVisible, COLLECTION_COLUMNS, type Collection } from "../data";

const TONES = { counted: "gold", needs_review: "warn", confirmed: "teal", void: "plain" } as const;

export default async function CollectionPage({ params, searchParams }: PageProps<"/kewangan/kutipan/[id]">) {
  const { user, role } = await requireMember("finance.view");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { hasil } = await searchParams;

  const supabase = await createClient();
  const { data } = await supabase.from("collections").select(COLLECTION_COLUMNS).eq("id", id).maybeSingle();
  if (!data) notFound();
  const collection = data as Collection;

  const [funds, names, t, locale] = await Promise.all([loadFunds(), loadMemberNames(), getTranslations("kutipan"), getLocale()]);
  const receipt = collection.transaction_id
    ? (await supabase.from("transactions").select("id, receipt_no").eq("id", collection.transaction_id).maybeSingle()).data
    : null;

  const who = (userId: string | null) => (userId === user.id ? t("you") : userId ? (names.get(userId) ?? "—") : "—");
  const mine = collection.counted_by === user.id;
  const open = collection.status === "counted" || collection.status === "needs_review";
  const showAmount = amountVisible(collection, user.id);
  const canConfirm = collection.status === "counted" && !mine && can(role, "collections.confirm");
  const canRecount = can(role, "collections.count") && (collection.status === "needs_review" || (collection.status === "counted" && mine));
  const canCancel = open && (can(role, "transactions.reverse") || (mine && can(role, "collections.count")));

  return (
    <>
      <BackLink href="/kewangan/kutipan" label={t("title")} />
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-3xl font-bold tracking-tight">{t("countOn", { date: formatDay(collection.date, locale) })}</h1>
        <Badge tone={TONES[collection.status]}>{t(`status.${collection.status}`)}</Badge>
      </div>

      {hasil === "disahkan" ? (
        <div className="mt-4">
          <Notice tone="success">{t("resultConfirmed", { receipt: receipt?.receipt_no ?? "" })}</Notice>
        </div>
      ) : hasil === "semak" ? (
        <div className="mt-4">
          <Notice tone="error">{t("resultReview")}</Notice>
        </div>
      ) : hasil === "dikira" ? (
        <div className="mt-4">
          <Notice tone="success">{t("resultCounted")}</Notice>
        </div>
      ) : null}

      <section aria-label={t("details")} className="mt-5 rounded-card bg-surface p-5">
        <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-[10rem_1fr]">
          <dt className="text-sm text-muted">{t("amount")}</dt>
          <dd className="text-2xl font-bold tabular-nums" data-testid="jumlah-kutipan">
            {showAmount ? formatSen(collection.total_sen) : <span className="text-base font-normal text-muted">{t("hiddenLong")}</span>}
          </dd>
          <dt className="text-sm text-muted">{t("fund")}</dt>
          <dd>{funds.find((fund) => fund.id === collection.fund_id)?.name ?? "—"}</dd>
          <dt className="text-sm text-muted">{t("countedByLabel")}</dt>
          <dd>{t("byOn", { name: who(collection.counted_by), date: formatDate(collection.updated_at, locale) })}</dd>
          {collection.note ? (
            <>
              <dt className="text-sm text-muted">{t("note")}</dt>
              <dd className="whitespace-pre-line">{collection.note}</dd>
            </>
          ) : null}
          {showAmount && collection.breakdown ? (
            <>
              <dt className="text-sm text-muted">{t("breakdown")}</dt>
              <dd>
                <ul className="text-sm tabular-nums">
                  {NOTES.filter((note) => collection.breakdown?.[`${note}`]).map((note) => (
                    <li key={note}>
                      RM{note} × {collection.breakdown?.[`${note}`]} = {formatSen((collection.breakdown?.[`${note}`] ?? 0) * note * 100)}
                    </li>
                  ))}
                  {collection.breakdown.coins_sen ? (
                    <li>
                      {t("coins")}: {formatSen(collection.breakdown.coins_sen)}
                    </li>
                  ) : null}
                </ul>
              </dd>
            </>
          ) : null}
          {collection.status === "confirmed" ? (
            <>
              <dt className="text-sm text-muted">{t("confirmedByLabel")}</dt>
              <dd>{t("byOn", { name: who(collection.confirmed_by), date: formatDate(collection.confirmed_at ?? collection.updated_at, locale) })}</dd>
              <dt className="text-sm text-muted">{t("receipt")}</dt>
              <dd>
                {receipt ? (
                  <Link href={`/kewangan/${receipt.id}`} className="font-semibold text-primary-dark underline underline-offset-4">
                    {receipt.receipt_no ?? t("viewEntry")}
                  </Link>
                ) : (
                  "—"
                )}
              </dd>
            </>
          ) : null}
          {collection.status === "void" ? (
            <>
              <dt className="text-sm text-muted">{t("cancelledByLabel")}</dt>
              <dd>
                {who(collection.voided_by)} · {collection.void_reason}
              </dd>
            </>
          ) : null}
        </dl>
      </section>

      {collection.status === "needs_review" ? (
        <section className="mt-5 rounded-card bg-warn-bg p-5 text-warn-ink" data-testid="perlu-semak">
          <h2 className="text-lg font-bold">{t("reviewTitle")}</h2>
          <p className="mt-1">
            {t("reviewLine", {
              first: formatSen(collection.total_sen),
              firstBy: who(collection.counted_by),
              second: formatSen(collection.check_total_sen ?? 0),
              secondBy: who(collection.checked_by),
            })}
          </p>
          <p className="mt-1 text-sm">{t("reviewHelp")}</p>
        </section>
      ) : null}

      {collection.status === "counted" && mine ? (
        <p className="mt-5 rounded-card bg-tint p-4 text-primary-dark">{t("waitForOther")}</p>
      ) : null}

      {canConfirm ? (
        <section aria-labelledby="sahkan" className="mt-6 rounded-card bg-surface p-5">
          <h2 id="sahkan" className="text-lg font-bold">
            {t("confirmTitle")}
          </h2>
          <p className="mt-1 text-sm text-muted">{t("confirmLead")}</p>
          <ConfirmForm id={collection.id} />
        </section>
      ) : null}

      {canRecount ? (
        <section aria-labelledby="kira-semula" className="mt-6 rounded-card bg-surface p-5">
          <h2 id="kira-semula" className="text-lg font-bold">
            {collection.status === "needs_review" ? t("recountTitle") : t("fixTitle")}
          </h2>
          <p className="mt-1 text-sm text-muted">{t("recountLead")}</p>
          <RecountForm id={collection.id} />
        </section>
      ) : null}

      {canCancel ? (
        <section aria-labelledby="batal-kiraan" className="mt-8 border-t border-rule pt-5">
          <h2 id="batal-kiraan" className="text-lg font-bold">
            {t("cancelTitle")}
          </h2>
          <p className="mt-1 text-sm text-muted">{t("cancelLead")}</p>
          <CancelForm id={collection.id} />
        </section>
      ) : null}
    </>
  );
}
