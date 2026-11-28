import Link from "next/link";
import { notFound } from "next/navigation";
import { CircleAlert, CircleCheck, OctagonX } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { BackLink } from "@/components/BackLink";
import { Badge } from "@/components/kewangan/bits";
import { LockForm, UnlockForm } from "@/components/periods/LockForms";
import { Notice } from "@/components/ui/forms";
import { currentMonth, parseMonth } from "@/lib/cashbook";
import { formatDate, formatDateTime, formatDay, formatMonth } from "@/lib/dates";
import { formatSen } from "@/lib/money";
import { can } from "@/lib/permissions";
import { canLockMonth, type ChecklistItem } from "@/lib/periods";
import { requireMember } from "@/lib/session";
import { loadMemberNames } from "../../data";
import { loadChecklist, loadLockHistory, loadMonthReports, loadPeriods } from "../data";

const pick = (value: string | string[] | undefined) => (typeof value === "string" ? value : "");

export default async function MonthPage({ params, searchParams }: PageProps<"/kewangan/tutup-bulan/[bulan]">) {
  const { role } = await requireMember("periods.view");
  const month = parseMonth((await params).bulan);
  if (!month) notFound();
  const query = await searchParams;
  const [t, locale] = await Promise.all([getTranslations("tutupBulan"), getLocale()]);

  const [periods, names, { pending, checklist }, reports] = await Promise.all([
    loadPeriods(),
    loadMemberNames(),
    loadChecklist(month),
    loadMonthReports(month),
  ]);
  const period = periods.get(month);
  const history = period ? await loadLockHistory(period.id) : [];
  const locked = !!period?.locked_at;
  const ended = canLockMonth(month, currentMonth());
  const canLock = can(role, "periods.lock");
  const done = pick(query.ok);

  const name = (id: string | null) => (id ? (names.get(id) ?? t("someone")) : t("someone"));
  const links: Partial<Record<ChecklistItem["key"], string>> = {
    collections: "/kewangan/kutipan",
    noStatement: "/kewangan/bank/import",
    bankLines: `/kewangan/bank?bulan=${month}`,
    bankDifference: `/kewangan/bank?bulan=${month}`,
    entries: `/kewangan/bank?bulan=${month}`,
  };
  const icon = (state: ChecklistItem["state"]) =>
    state === "block" ? (
      <OctagonX aria-hidden className="size-5 shrink-0 text-warn-ink" />
    ) : state === "warn" ? (
      <CircleAlert aria-hidden className="size-5 shrink-0 text-gold" />
    ) : (
      <CircleCheck aria-hidden className="size-5 shrink-0 text-primary" />
    );

  return (
    <>
      <BackLink href="/kewangan/tutup-bulan" label={t("title")} />
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-3xl font-bold tracking-tight">{formatMonth(month, locale)}</h1>
        {locked ? <Badge tone="teal">{t("locked")}</Badge> : <Badge tone="plain">{t("open")}</Badge>}
      </div>

      <div className="mt-4 max-w-3xl space-y-2">
        {done === "dikunci" ? <Notice tone="success">{t("doneLocked")}</Notice> : null}
        {done === "dibuka" ? <Notice tone="success">{t("doneUnlocked")}</Notice> : null}
      </div>

      {locked ? (
        <section aria-labelledby="dikunci" className="mt-4 max-w-3xl rounded-card bg-surface p-5" data-testid="bulan-dikunci">
          <h2 id="dikunci" className="text-lg font-bold">
            {t("lockedTitle")}
          </h2>
          <p className="mt-1 text-muted">{t("lockedBy", { name: name(period!.locked_by), date: formatDate(period!.locked_at!, locale) })}</p>
          <p className="mt-2 text-sm">{t("lockedLead")}</p>
          {canLock ? (
            <div className="mt-4">
              <UnlockForm month={month} />
            </div>
          ) : null}
        </section>
      ) : !ended ? (
        <p className="mt-4 max-w-3xl rounded-card bg-surface p-5 text-muted">{t("notEnded")}</p>
      ) : (
        <section aria-labelledby="semak" className="mt-4 max-w-3xl rounded-card bg-surface p-5" data-testid="senarai-semak">
          <h2 id="semak" className="text-lg font-bold">
            {t("checklistTitle")}
          </h2>
          <p className="mt-1 text-sm text-muted">{t("checklistLead")}</p>
          <ul className="mt-3 divide-y divide-rule">
            {checklist.items.map((item) => (
              <li key={item.key} className="flex items-start gap-3 py-3" data-testid={`semak-${item.key}`} data-state={item.state}>
                {icon(item.state)}
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">
                    {t(`items.${item.key}.${item.state === "ok" ? "ok" : "problem"}`, { count: item.count ?? 0, amount: formatSen(item.sen ?? 0) })}
                  </span>
                  {item.state !== "ok" ? <span className="block text-sm text-muted">{t(`items.${item.key}.hint`)}</span> : null}
                  {item.key === "drafts" ? <span className="block text-sm text-muted">{t("items.drafts.hint")}</span> : null}
                  {item.key === "collections" && pending.length > 0 ? (
                    <span className="mt-1 block text-sm">
                      {pending.map((row) => `${formatDay(row.date, locale)} · ${formatSen(row.total_sen)} · ${t(`collectionStatus.${row.status}`)}`).join("; ")}
                    </span>
                  ) : null}
                  {item.state !== "ok" && links[item.key] ? (
                    <Link href={links[item.key]!} className="mt-1 inline-flex min-h-tap items-center font-semibold text-primary-dark underline underline-offset-4">
                      {t(`items.${item.key}.link`)}
                    </Link>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
          {canLock ? (
            <div className="mt-4 border-t border-rule pt-4">
              <p className="mb-3 text-sm">{t("lockLead")}</p>
              <LockForm month={month} blocked={checklist.blocked} warnings={checklist.warnings} />
            </div>
          ) : (
            <p className="mt-4 text-sm text-muted">{t("onlyPengerusi")}</p>
          )}
        </section>
      )}

      {reports.length > 0 ? (
        <section aria-labelledby="laporan" className="mt-5 max-w-3xl">
          <h2 id="laporan" className="text-lg font-bold">
            {t("reportsTitle")}
          </h2>
          <ul className="mt-2 divide-y divide-rule rounded-card bg-surface" data-testid="laporan-bulan">
            {reports.map((report) => (
              <li key={report.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                <span>
                  <span className="block font-medium">{t("reportLine", { type: report.type, period: report.period })}</span>
                  <span className="block text-muted">{formatDate(report.created_at, locale)}</span>
                </span>
                {report.invalidated_at ? <Badge tone="warn">{t("reportInvalid")}</Badge> : <Badge tone="teal">{t("reportValid")}</Badge>}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-sm text-muted">{t("reportsHint")}</p>
        </section>
      ) : null}

      {history.length > 0 ? (
        <section aria-labelledby="sejarah" className="mt-5 max-w-3xl">
          <h2 id="sejarah" className="text-lg font-bold">
            {t("historyTitle")}
          </h2>
          <ul className="mt-2 divide-y divide-rule rounded-card bg-surface text-sm" data-testid="sejarah-kunci">
            {history.map((event) => (
              <li key={event.id} className="px-4 py-3">
                <span className="block font-medium">
                  {event.kind === "lock" ? t("historyLock", { name: name(event.user_id) }) : t("historyUnlock", { name: name(event.user_id) })}
                </span>
                <span className="block text-muted">{formatDateTime(event.at, locale)}</span>
                {event.reason ? <span className="block">{t("historyReason", { reason: event.reason })}</span> : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}
