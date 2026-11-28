import { getLocale, getTranslations } from "next-intl/server";
import { BackLink } from "@/components/BackLink";
import { BankImportForm } from "@/components/bank/BankImportForm";
import { Badge } from "@/components/kewangan/bits";
import { Notice, SubmitButton } from "@/components/ui/forms";
import { formatDate, formatDay } from "@/lib/dates";
import { requireMember } from "@/lib/session";
import { cancelImport } from "../actions";
import { importsInUse, loadFormats, loadImports } from "../data";

const pick = (value: string | string[] | undefined) => (typeof value === "string" ? value : "");

export default async function BankImportPage({ searchParams }: PageProps<"/kewangan/bank/import">) {
  await requireMember("bank.match");
  const [t, errors] = await Promise.all([getTranslations("bankImport"), getTranslations("errors")]);
  const b = await getTranslations("bank");
  const locale = await getLocale();
  const params = await searchParams;

  const [formats, imports] = await Promise.all([loadFormats(), loadImports()]);
  const inUse = await importsInUse(imports.map((item) => item.id));
  const failed = pick(params.ralat);
  const done = pick(params.ok);

  return (
    <>
      <BackLink href="/kewangan/bank" label={b("title")} />
      <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
      <p className="mt-1 max-w-2xl text-muted">{t("lead")}</p>

      <div className="mt-4 space-y-2">
        {done ? <Notice tone="success">{b(`done.${done}`)}</Notice> : null}
        {failed ? <Notice tone="error">{errors(failed)}</Notice> : null}
      </div>

      <BankImportForm formats={formats} />

      {imports.length > 0 ? (
        <section aria-labelledby="terdahulu" className="mt-8 max-w-3xl">
          <h2 id="terdahulu" className="text-lg font-bold">
            {t("pastTitle")}
          </h2>
          <ul className="mt-2 divide-y divide-rule rounded-card bg-surface" data-testid="import-terdahulu">
            {imports.map((item) => (
              <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <span className="min-w-0 text-sm">
                  <span className="block font-medium break-all">{item.file_name}</span>
                  <span className="block text-muted">
                    {formatDate(item.created_at, locale)} ·{" "}
                    {t("pastCounts", { added: item.lines_added, skipped: item.lines_skipped })}
                    {item.first_date && item.last_date
                      ? ` · ${formatDay(item.first_date, locale)} – ${formatDay(item.last_date, locale)}`
                      : ""}
                  </span>
                </span>
                {item.cancelled_at ? (
                  <Badge tone="warn">{t("cancelled")}</Badge>
                ) : inUse.has(item.id) ? (
                  <span className="text-sm text-muted">{t("inUse")}</span>
                ) : (
                  <form action={cancelImport.bind(null, item.id)}>
                    <SubmitButton variant="secondary" pendingLabel={b("working")}>
                      {t("cancel")}
                    </SubmitButton>
                  </form>
                )}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-sm text-muted">{t("cancelHint")}</p>
        </section>
      ) : null}
    </>
  );
}
