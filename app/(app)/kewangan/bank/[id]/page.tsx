import Link from "next/link";
import { notFound } from "next/navigation";
import { Plus } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { BackLink } from "@/components/BackLink";
import { Badge, SignedAmount } from "@/components/kewangan/bits";
import { Notice, SubmitButton } from "@/components/ui/forms";
import { candidatesFor, daysApart } from "@/lib/bank-matching";
import { formatDay } from "@/lib/dates";
import { can } from "@/lib/permissions";
import { requireMember } from "@/lib/session";
import { isMonthLocked, loadCategories } from "../../data";
import { acceptMatch, clearLine, markCash } from "../actions";
import { loadBankLine, loadEntry, loadSameAmount } from "../data";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const pick = (value: string | string[] | undefined) => (typeof value === "string" ? value : "");

/** One bank line: what it is matched to, or the ways to explain it. */
export default async function BankLinePage({ params, searchParams }: PageProps<"/kewangan/bank/[id]">) {
  const { role } = await requireMember("bank.view");
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const [t, errors, k] = await Promise.all([getTranslations("bank"), getTranslations("errors"), getTranslations("kewangan")]);
  const locale = await getLocale();
  const query = await searchParams;

  const line = await loadBankLine(id);
  if (!line) notFound();
  const month = line.date.slice(0, 7);
  const back = `/kewangan/bank/${line.id}`;
  const [locked, categories, matched] = await Promise.all([
    isMonthLocked(month),
    loadCategories(),
    line.matched_transaction_id ? loadEntry(line.matched_transaction_id) : Promise.resolve(null),
  ]);
  const canAct = can(role, "bank.match") && !locked;
  const open = !line.cash_transfer && !line.matched_transaction_id;
  const categoryName = new Map(categories.map((category) => [category.id, category.name]));

  const same = open ? await loadSameAmount(line.amount_sen) : null;
  const candidates = same ? candidatesFor(line, same.entries, same.taken) : [];
  const failed = pick(query.ralat);
  const done = pick(query.ok);

  return (
    <>
      <BackLink href={`/kewangan/bank?bulan=${month}`} label={t("title")} />
      <h1 className="text-3xl font-bold tracking-tight">{t("lineTitle")}</h1>

      <div className="mt-4 space-y-2">
        {done ? <Notice tone="success">{t(`done.${done}`)}</Notice> : null}
        {failed ? <Notice tone="error">{errors(failed)}</Notice> : null}
        {locked ? <Notice tone="error">{t("locked")}</Notice> : null}
      </div>

      <section className="mt-4 max-w-2xl rounded-card bg-surface p-5" data-testid="bank-baris-butiran">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm text-muted">{formatDay(line.date, locale)}</p>
            <p className="font-semibold break-words">{line.description || t("noDescription")}</p>
          </div>
          <SignedAmount sen={Math.abs(line.amount_sen)} direction={line.amount_sen > 0 ? "in" : "out"} className="shrink-0 text-lg font-bold" />
        </div>
        <p className="mt-3 text-sm">
          {line.cash_transfer ? (
            <Badge tone="teal">{line.amount_sen > 0 ? t("cashDeposit") : t("cashWithdrawal")}</Badge>
          ) : matched ? (
            <Badge tone="teal">{t("matched")}</Badge>
          ) : (
            <Badge tone="warn">{t("notMatched")}</Badge>
          )}
        </p>
        {matched ? (
          <p className="mt-2 text-sm">
            <Link href={`/kewangan/${matched.id}`} className="font-semibold text-primary-dark underline underline-offset-4">
              {[formatDay(matched.date, locale), matched.category_id ? categoryName.get(matched.category_id) : null, matched.note].filter(Boolean).join(" · ")}
            </Link>
          </p>
        ) : null}
        {!open && canAct ? (
          <form action={clearLine.bind(null, back, line.id)} className="mt-3">
            <SubmitButton variant="secondary" pendingLabel={t("working")}>
              {line.cash_transfer ? t("unmarkCash") : t("unmatch")}
            </SubmitButton>
          </form>
        ) : null}
      </section>

      {open && canAct ? (
        <>
          <section aria-labelledby="calon" className="mt-5 max-w-2xl">
            <h2 id="calon" className="text-lg font-bold">
              {t("candidatesTitle")}
            </h2>
            <p className="text-sm text-muted">{t("candidatesLead")}</p>
            {candidates.length === 0 ? (
              <p className="mt-2 rounded-card bg-surface p-4 text-muted">{t("noCandidates")}</p>
            ) : (
              <ul className="mt-2 divide-y divide-rule rounded-card bg-surface" data-testid="bank-calon">
                {candidates.slice(0, 30).map((entry) => (
                  <li key={entry.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                    <span className="min-w-0 text-sm">
                      <span className="block font-medium">
                        {[formatDay(entry.date, locale), entry.category_id ? categoryName.get(entry.category_id) : null].filter(Boolean).join(" · ")}
                      </span>
                      <span className="block text-muted">
                        {[entry.note, entry.ref_no, k(`methods.${entry.method}`), t("daysAway", { days: daysApart(line.date, entry.date) })].filter(Boolean).join(" · ")}
                      </span>
                    </span>
                    <form action={acceptMatch.bind(null, back, line.id, entry.id)}>
                      <SubmitButton pendingLabel={t("working")}>{t("matchThis")}</SubmitButton>
                    </form>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-labelledby="lain" className="mt-5 max-w-2xl rounded-card bg-surface p-5">
            <h2 id="lain" className="text-lg font-bold">
              {t("otherWaysTitle")}
            </h2>
            <div className="mt-3 space-y-4">
              <div>
                <Link
                  href={`/kewangan/baru?bank=${line.id}`}
                  className="inline-flex min-h-tap items-center gap-2 rounded-chip bg-primary px-4 font-semibold text-surface"
                >
                  <Plus aria-hidden className="size-4" />
                  {t("createEntry")}
                </Link>
                <p className="mt-1 text-sm text-muted">{t("createEntryHint")}</p>
              </div>
              <div>
                <form action={markCash.bind(null, back, line.id)}>
                  <SubmitButton variant="secondary" pendingLabel={t("working")}>
                    {line.amount_sen > 0 ? t("markDeposit") : t("markWithdrawal")}
                  </SubmitButton>
                </form>
                <p className="mt-1 text-sm text-muted">{line.amount_sen > 0 ? t("markDepositHint") : t("markWithdrawalHint")}</p>
              </div>
            </div>
          </section>
        </>
      ) : null}
    </>
  );
}
