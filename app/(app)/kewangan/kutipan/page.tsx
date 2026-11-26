import Link from "next/link";
import { Plus } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { BackLink } from "@/components/BackLink";
import { CollectionRow } from "@/components/kutipan/CollectionRow";
import { PendingQueue } from "@/components/kutipan/PendingQueue";
import { can } from "@/lib/permissions";
import { requireMember } from "@/lib/session";
import { loadFunds, loadMemberNames } from "../data";
import { loadOpenCollections, loadRecentCollections } from "./data";

export default async function CollectionsPage() {
  const { user, role } = await requireMember("finance.view");
  const t = await getTranslations("kutipan");
  const [open, recent, funds, names] = await Promise.all([
    loadOpenCollections(),
    loadRecentCollections(),
    loadFunds(),
    loadMemberNames(),
  ]);
  const fundName = new Map(funds.map((fund) => [fund.id, fund.name]));
  const canCount = can(role, "collections.count");

  const list = (rows: typeof open, testId: string) => (
    <ul className="mt-3 divide-y divide-rule rounded-card bg-surface" data-testid={testId}>
      {rows.map((collection) => (
        <CollectionRow
          key={collection.id}
          collection={collection}
          userId={user.id}
          fundName={fundName.get(collection.fund_id) ?? "—"}
          names={names}
        />
      ))}
    </ul>
  );

  return (
    <>
      <BackLink href="/kewangan" label={t("back")} />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
          <p className="mt-1 text-muted">{t("lead")}</p>
        </div>
        {canCount ? (
          <Link
            href="/kewangan/kutipan/baru"
            className="inline-flex min-h-tap items-center gap-2 rounded-chip bg-primary px-4 font-semibold text-surface"
          >
            <Plus aria-hidden className="size-4" />
            {t("startCount")}
          </Link>
        ) : null}
      </div>

      {canCount ? <PendingQueue userId={user.id} /> : null}

      <section aria-labelledby="menunggu" className="mt-6">
        <h2 id="menunggu" className="text-lg font-bold">
          {t("waiting")}
        </h2>
        {open.length === 0 ? <p className="mt-3 rounded-card bg-surface p-5 text-muted">{t("noneWaiting")}</p> : list(open, "kutipan-menunggu")}
      </section>

      <section aria-labelledby="selesai" className="mt-6">
        <h2 id="selesai" className="text-lg font-bold">
          {t("done")}
        </h2>
        {recent.length === 0 ? <p className="mt-3 rounded-card bg-surface p-5 text-muted">{t("noneDone")}</p> : list(recent, "kutipan-selesai")}
      </section>
    </>
  );
}
