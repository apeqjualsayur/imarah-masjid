import Link from "next/link";
import { Download } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { BackLink } from "@/components/BackLink";
import { Badge } from "@/components/kewangan/bits";
import { AUDIT_ACTIONS, AUDIT_GROUPS, AUDIT_PAGE_SIZE } from "@/lib/audit";
import { can } from "@/lib/permissions";
import { requireMember } from "@/lib/session";
import { loadMemberNames } from "../../kewangan/data";
import { filterQuery, loadAudit, readable, readFilters } from "./data";

const CHANGES_SHOWN = 12;

/** The audit log: read only, filtered, newest first. Nothing here can change it. */
export default async function AuditPage({ searchParams }: PageProps<"/tetapan/audit">) {
  const { role } = await requireMember("audit.view");
  const [t, s] = await Promise.all([getTranslations("audit"), getTranslations("settings")]);
  const params = await searchParams;
  const filters = readFilters(params);
  const page = Math.max(1, Math.min(1000, Number(typeof params.halaman === "string" ? params.halaman : 1) || 1));

  const [found, names] = await Promise.all([loadAudit(filters, (page - 1) * AUDIT_PAGE_SIZE, AUDIT_PAGE_SIZE + 1), loadMemberNames()]);
  const hasMore = found.length > AUDIT_PAGE_SIZE;
  const rows = await readable(found.slice(0, AUDIT_PAGE_SIZE));
  const people = [...names.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  const filtered = !!(filters.from || filters.to || filters.user || filters.group || filters.action);

  const field = "mt-1.5 block min-h-tap w-full rounded-chip border border-border bg-surface px-3 py-2 text-base";

  return (
    <>
      <BackLink href="/tetapan" label={s("title")} />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
          <p className="mt-1 max-w-2xl text-muted">{t("lead")}</p>
        </div>
        {can(role, "audit.export") ? (
          <a
            href={`/tetapan/audit/eksport?${filterQuery(filters)}`}
            className="inline-flex min-h-tap items-center gap-2 rounded-chip border border-border bg-surface px-4 font-semibold text-primary-dark"
          >
            <Download aria-hidden className="size-4" />
            {t("export")}
          </a>
        ) : null}
      </div>

      <form method="get" className="mt-5 grid gap-3 rounded-card bg-surface p-4 sm:grid-cols-2 lg:grid-cols-5" aria-label={t("filters")}>
        <label className="block text-sm font-semibold">
          {t("from")}
          <input type="date" name="dari" defaultValue={filters.from} className={field} />
        </label>
        <label className="block text-sm font-semibold">
          {t("to")}
          <input type="date" name="hingga" defaultValue={filters.to} className={field} />
        </label>
        <label className="block text-sm font-semibold">
          {t("user")}
          <select name="pengguna" defaultValue={filters.user} className={field}>
            <option value="">{t("allUsers")}</option>
            {people.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
            <option value="sistem">{t("system")}</option>
          </select>
        </label>
        <label className="block text-sm font-semibold">
          {t("group")}
          <select name="jenis" defaultValue={filters.group} className={field}>
            <option value="">{t("allGroups")}</option>
            {Object.keys(AUDIT_GROUPS).map((group) => (
              <option key={group} value={group}>
                {t(`groups.${group}`)}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm font-semibold">
          {t("action")}
          <select name="tindakan" defaultValue={filters.action} className={field}>
            <option value="">{t("allActions")}</option>
            {AUDIT_ACTIONS.map((action) => (
              <option key={action} value={action}>
                {t(`actions.${action}`)}
              </option>
            ))}
          </select>
        </label>
        <div className="flex flex-wrap gap-2 sm:col-span-2 lg:col-span-5">
          <button type="submit" className="inline-flex min-h-tap items-center rounded-chip bg-primary px-5 font-semibold text-surface">
            {t("filter")}
          </button>
          {filtered ? (
            <Link href="/tetapan/audit" className="inline-flex min-h-tap items-center rounded-chip px-4 font-semibold text-primary-dark underline underline-offset-4">
              {t("clear")}
            </Link>
          ) : null}
        </div>
      </form>

      {rows.length === 0 ? (
        <p className="mt-5 rounded-card bg-surface p-6 text-muted">{filtered ? t("emptyFiltered") : t("empty")}</p>
      ) : (
        <ol className="mt-5 space-y-2" data-testid="log-audit">
          {rows.map((row) => (
            <li key={row.id} className="min-w-0 rounded-card bg-surface p-4" data-testid="audit-baris">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="plain">{row.kind}</Badge>
                <span className="font-semibold">
                  {row.group} · {row.table}
                </span>
              </div>
              <p className="mt-1 text-sm text-muted [overflow-wrap:anywhere]">{t("byLine", { who: row.who, at: row.at })}</p>
              {row.changes.length > 0 ? (
                <dl className="mt-2 grid grid-cols-[minmax(0,1fr)] gap-x-4 gap-y-1 text-sm sm:grid-cols-[minmax(8rem,auto)_minmax(0,1fr)]">
                  {row.changes.slice(0, CHANGES_SHOWN).map((change, i) => (
                    <div key={i} className="contents">
                      <dt className="text-muted">{change.label}</dt>
                      <dd className="min-w-0 [overflow-wrap:anywhere]">
                        {change.before !== null && change.after !== null ? (
                          <>
                            <span className="text-muted line-through decoration-1">{change.before}</span>
                            <span aria-hidden> → </span>
                            <span className="sr-only"> {t("becomes")} </span>
                            <span className="font-medium">{change.after}</span>
                          </>
                        ) : (
                          <span className="font-medium">{change.after ?? change.before}</span>
                        )}
                      </dd>
                    </div>
                  ))}
                </dl>
              ) : null}
              {row.changes.length > CHANGES_SHOWN ? <p className="mt-1 text-sm text-muted">{t("moreChanges", { count: row.changes.length - CHANGES_SHOWN })}</p> : null}
            </li>
          ))}
        </ol>
      )}

      {page > 1 || hasMore ? (
        <nav aria-label={t("pages")} className="mt-4 flex items-center justify-between gap-2">
          {page > 1 ? (
            <Link href={`/tetapan/audit?${filterQuery(filters, { halaman: `${page - 1}` })}`} className="inline-flex min-h-tap items-center font-semibold text-primary-dark underline underline-offset-4">
              {t("newer")}
            </Link>
          ) : (
            <span />
          )}
          <span className="text-sm text-muted">{t("page", { page })}</span>
          {hasMore ? (
            <Link href={`/tetapan/audit?${filterQuery(filters, { halaman: `${page + 1}` })}`} className="inline-flex min-h-tap items-center font-semibold text-primary-dark underline underline-offset-4">
              {t("older")}
            </Link>
          ) : (
            <span />
          )}
        </nav>
      ) : null}
    </>
  );
}
