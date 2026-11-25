import Link from "next/link";
import { ChevronLeft, ChevronRight, Plus, Search, Upload } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { ConsentBadges } from "@/components/kariah/ConsentBadges";
import { can } from "@/lib/permissions";
import { formatPhone } from "@/lib/phone";
import { requireMember } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

const PAGE_SIZE = 50;

type Row = {
  id: string;
  head_name: string;
  phone: string | null;
  address: string | null;
  whatsapp_opt_in: boolean;
  pdpa_consent_at: string | null;
  members: { count: number }[];
};

export default async function KariahPage({ searchParams }: PageProps<"/kariah">) {
  const { role } = await requireMember("kariah.view");
  const t = await getTranslations("kariah");
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q.trim().slice(0, 80) : "";
  const page = Math.max(1, Number(params.halaman) || 1);

  const supabase = await createClient();
  let query = supabase
    .from("households")
    .select("id, head_name, phone, address, whatsapp_opt_in, pdpa_consent_at, members(count)", { count: "exact" })
    .order("head_name")
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

  if (q) {
    // Characters that would change the filter itself are dropped.
    const safe = q.replace(/[,()*%\\]/g, " ").trim();
    const digits = safe.replace(/\D/g, "");
    const filters = [`head_name.ilike.%${safe}%`, `address.ilike.%${safe}%`];
    if (digits.length >= 3) filters.push(`phone.ilike.%${digits.replace(/^6?0/, "")}%`);
    query = query.or(filters.join(","));
  }

  const { data, count } = await query;
  const rows = (data ?? []) as Row[];
  const total = count ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const pageLink = (n: number) => `/kariah?${new URLSearchParams({ ...(q ? { q } : {}), halaman: `${n}` })}`;

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
          <p className="mt-1 text-muted">{t("count", { count: total })}</p>
        </div>
        {can(role, "kariah.edit") ? (
          <div className="flex flex-wrap gap-2">
            <Link
              href="/kariah/import"
              className="inline-flex min-h-tap items-center gap-2 rounded-chip border border-border bg-surface px-4 font-semibold text-primary-dark"
            >
              <Upload aria-hidden className="size-4" />
              {t("import")}
            </Link>
            <Link
              href="/kariah/baru"
              className="inline-flex min-h-tap items-center gap-2 rounded-chip bg-primary px-4 font-semibold text-surface"
            >
              <Plus aria-hidden className="size-4" />
              {t("add")}
            </Link>
          </div>
        ) : null}
      </div>

      <form role="search" className="mt-5 flex gap-2">
        <label className="relative flex-1">
          <span className="sr-only">{t("search")}</span>
          <Search aria-hidden className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
          <input
            name="q"
            defaultValue={q}
            placeholder={t("searchPlaceholder")}
            className="min-h-tap w-full rounded-chip border border-border bg-surface py-2 pr-3 pl-9"
          />
        </label>
        <button type="submit" className="min-h-tap rounded-chip bg-primary px-4 font-semibold text-surface">
          {t("searchButton")}
        </button>
      </form>

      {rows.length === 0 ? (
        <p className="mt-5 rounded-card bg-surface p-6 text-muted">{q ? t("noResults", { q }) : t("empty")}</p>
      ) : (
        <ul className="mt-5 divide-y divide-rule rounded-card bg-surface">
          {rows.map((row) => (
            <li key={row.id}>
              <Link href={`/kariah/${row.id}`} className="flex min-h-tap items-center gap-4 px-4 py-3 hover:bg-background">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{row.head_name}</p>
                  <p className="truncate text-sm text-muted">
                    {[row.phone ? formatPhone(row.phone) : null, row.address].filter(Boolean).join(" · ") || "—"}
                  </p>
                </div>
                <div className="hidden shrink-0 sm:block">
                  <ConsentBadges whatsapp={row.whatsapp_opt_in} pdpa={!!row.pdpa_consent_at} />
                </div>
                <span className="shrink-0 text-sm text-muted">{t("memberCount", { count: row.members[0]?.count ?? 0 })}</span>
                <ChevronRight aria-hidden className="size-5 shrink-0 text-muted" />
              </Link>
            </li>
          ))}
        </ul>
      )}

      {pages > 1 ? (
        <nav aria-label={t("pages")} className="mt-4 flex items-center justify-between gap-3 text-sm">
          {page > 1 ? (
            <Link href={pageLink(page - 1)} className="inline-flex min-h-tap items-center gap-1 font-semibold text-primary-dark">
              <ChevronLeft aria-hidden className="size-4" />
              {t("previous")}
            </Link>
          ) : (
            <span />
          )}
          <span className="text-muted">{t("pageOf", { page, pages })}</span>
          {page < pages ? (
            <Link href={pageLink(page + 1)} className="inline-flex min-h-tap items-center gap-1 font-semibold text-primary-dark">
              {t("next")}
              <ChevronRight aria-hidden className="size-4" />
            </Link>
          ) : (
            <span />
          )}
        </nav>
      ) : null}
    </>
  );
}
