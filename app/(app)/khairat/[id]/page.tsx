import Link from "next/link";
import { notFound } from "next/navigation";
import { ReceiptText } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { BackLink } from "@/components/BackLink";
import { EndForm, PaymentForm } from "@/components/khairat/forms";
import { StatusBadge } from "@/components/khairat/StatusBadge";
import { Badge, Figure } from "@/components/kewangan/bits";
import { Notice } from "@/components/ui/forms";
import { todayInMalaysia } from "@/lib/cashbook";
import { formatDate, formatDay } from "@/lib/dates";
import { arrearsSen, dueSen, owedSen, statusOf } from "@/lib/khairat";
import { formatSen, senToPlain } from "@/lib/money";
import { can } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { TRANSACTION_COLUMNS, type Transaction } from "../../kewangan/data";
import { loadMemberships, loadPlans, requireKhairat } from "../data";

export default async function KhairatMemberPage({ params, searchParams }: PageProps<"/khairat/[id]">) {
  const { role } = await requireKhairat("khairat.view");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const [memberships, plans, t, k, locale, query] = await Promise.all([
    loadMemberships(),
    loadPlans(),
    getTranslations("khairat"),
    getTranslations("kewangan"),
    getLocale(),
    searchParams,
  ]);
  const member = memberships.find((row) => row.id === id);
  if (!member) notFound();
  const plan = plans.find((item) => item.id === member.plan_id)!;

  const today = todayInMalaysia();
  const status = statusOf(member, today);
  const owed = owedSen(member);

  const supabase = await createClient();
  const { data: payments } = await supabase
    .from("transactions")
    .select(TRANSACTION_COLUMNS)
    .eq("khairat_member_id", member.id)
    .order("date")
    .order("created_at");
  const rows = (payments ?? []) as Transaction[];
  const { data: cancels } = rows.length
    ? await supabase.from("transactions").select("reverses_id").in("reverses_id", rows.map((row) => row.id))
    : { data: [] };
  const cancelled = new Set((cancels ?? []).map((row: { reverses_id: string }) => row.reverses_id));

  // The same household's other years, with what is still owed on each.
  const otherYears = memberships.filter((row) => row.household_id === member.household_id && row.id !== member.id).sort((a, b) => b.year - a.year);

  const paidId = typeof query.dibayar === "string" && /^[0-9a-f-]{36}$/i.test(query.dibayar) ? query.dibayar : null;
  const canRecord = can(role, "khairat.record");
  const canViewReceipts = can(role, "receipts.view");

  return (
    <>
      <BackLink href={`/khairat?tahun=${member.year}`} label={t("title")} />
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-3xl font-bold tracking-tight">{member.head_name}</h1>
        <StatusBadge status={status} />
      </div>
      <p className="mt-1 text-muted">
        {t("memberLine", { year: member.year, date: formatDay(member.pay_by, locale) })}
        {plan.coverage === "person" ? ` · ${t("people", { count: member.people })}` : ""}
      </p>

      {paidId ? (
        <div className="mt-4">
          <Notice tone="success">
            {t("paymentSaved")}{" "}
            {canViewReceipts ? (
              <Link href={`/kewangan/resit/${paidId}`} className="font-semibold underline underline-offset-4">
                {t("openReceipt")}
              </Link>
            ) : null}
          </Notice>
        </div>
      ) : null}

      <section aria-label={t("summary")} className="mt-5 grid grid-cols-3 gap-4 rounded-card bg-surface p-4" data-testid="khairat-ahli-ringkasan">
        <Figure label={t("due")} sen={dueSen(member)} />
        <Figure label={t("paid")} sen={member.paid_sen} />
        <Figure label={t("owed")} sen={status === "tamat" ? 0 : owed} emphasis />
      </section>

      {member.ended_at ? (
        <section className="mt-5 rounded-card bg-rule p-5">
          <h2 className="text-lg font-bold">{t("endedTitle")}</h2>
          <p className="mt-1">{t("endedLine", { date: formatDate(member.ended_at, locale), reason: member.end_reason ?? "—" })}</p>
        </section>
      ) : null}

      <section aria-labelledby="bayaran" className="mt-5 rounded-card bg-surface p-5">
        <h2 id="bayaran" className="text-lg font-bold">
          {t("payments")}
        </h2>
        {rows.length === 0 ? (
          <p className="mt-2 text-muted">{member.paid_sen > 0 ? t("paidBeforeImarah") : t("noPayments")}</p>
        ) : (
          <ul className="mt-2 divide-y divide-rule">
            {rows.map((row) => (
              <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span>
                  <span className={`font-semibold tabular-nums ${cancelled.has(row.id) ? "text-muted line-through" : ""}`}>{formatSen(Number(row.amount_sen))}</span>
                  <span className="ml-2 text-sm text-muted">
                    {[formatDay(row.date, locale), k(`methods.${row.method}`), row.receipt_no].filter(Boolean).join(" · ")}
                  </span>
                  {cancelled.has(row.id) ? (
                    <span className="ml-2">
                      <Badge tone="warn">{k("cancelled")}</Badge>
                    </span>
                  ) : null}
                </span>
                {canViewReceipts && row.receipt_no ? (
                  <Link href={`/kewangan/resit/${row.id}`} className="inline-flex min-h-tap items-center gap-1 text-sm font-semibold text-primary-dark underline underline-offset-4">
                    <ReceiptText aria-hidden className="size-4" />
                    {t("receipt")}
                  </Link>
                ) : null}
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-sm text-muted">{t("cancelHint")}</p>
      </section>

      {canRecord && !member.ended_at && owed > 0 ? (
        <section aria-labelledby="rekod-bayaran" className="mt-5 rounded-card bg-surface p-5">
          <h2 id="rekod-bayaran" className="text-lg font-bold">
            {t("recordPaymentTitle", { year: member.year })}
          </h2>
          <PaymentForm
            id={member.id}
            headName={member.head_name}
            initial={{ amount: senToPlain(owed), date: today, method: "cash", ref_no: "", received_from: "" }}
          />
        </section>
      ) : null}

      {otherYears.length > 0 ? (
        <section aria-labelledby="tahun-lain" className="mt-5 rounded-card bg-surface p-5">
          <h2 id="tahun-lain" className="text-lg font-bold">
            {t("otherYears")}
          </h2>
          <ul className="mt-2 divide-y divide-rule">
            {otherYears.map((row) => {
              const rowStatus = statusOf(row, today);
              return (
                <li key={row.id}>
                  <Link href={`/khairat/${row.id}`} className="flex min-h-tap items-center justify-between gap-3 py-2">
                    <span className="flex items-center gap-2 font-semibold">
                      {row.year} <StatusBadge status={rowStatus} />
                    </span>
                    {arrearsSen(row, today) > 0 ? <span className="font-semibold text-warn-ink tabular-nums">{formatSen(arrearsSen(row, today))}</span> : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      <p className="mt-5">
        <Link href={`/kariah/${member.household_id}`} className="inline-flex min-h-tap items-center font-semibold text-primary-dark underline underline-offset-4">
          {t("openHousehold")}
        </Link>
      </p>

      {canRecord && !member.ended_at ? (
        <section aria-labelledby="tamat" className="mt-8 border-t border-rule pt-5">
          <h2 id="tamat" className="text-lg font-bold">
            {t("endTitle")}
          </h2>
          <p className="mt-1 text-sm text-muted">{t("endLead")}</p>
          <EndForm id={member.id} />
        </section>
      ) : null}
    </>
  );
}
