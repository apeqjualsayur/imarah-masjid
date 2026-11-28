import Link from "next/link";
import { notFound } from "next/navigation";
import { Download, ExternalLink, MessageCircle } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { BackLink } from "@/components/BackLink";
import { MasjidLogo } from "@/components/MasjidLogo";
import { QrCode } from "@/components/QrCode";
import { Badge } from "@/components/kewangan/bits";
import { ReceiptEmailForm } from "@/components/kewangan/ReceiptEmailForm";
import { senInMalayWords } from "@/lib/amount-words";
import { formatDay } from "@/lib/dates";
import { emailEnabled } from "@/lib/email";
import { formatSen } from "@/lib/money";
import { appOrigin } from "@/lib/origin";
import { can } from "@/lib/permissions";
import { makeReceiptToken, RECEIPT_LINK_DAYS, receiptLinkSecret } from "@/lib/receipt-link";
import { showsCredit } from "@/lib/receipts";
import { areaLine, getLogoUrl, requireMember } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { loadFunds, TRANSACTION_COLUMNS, type Transaction } from "../../data";

export default async function ReceiptPage({ params }: PageProps<"/kewangan/resit/[id]">) {
  const { role, masjid } = await requireMember("receipts.view");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const supabase = await createClient();
  const { data } = await supabase.from("transactions").select(TRANSACTION_COLUMNS).eq("id", id).not("receipt_no", "is", null).maybeSingle();
  if (!data) notFound();
  const entry = data as Transaction & { receipt_no: string };

  const [{ data: cancel }, { data: settings }, funds, logoUrl, t, pdf, k, locale] = await Promise.all([
    supabase.from("transactions").select("id, date").eq("reverses_id", entry.id).maybeSingle(),
    supabase.from("masjids").select("receipt_hide_credit, receipt_show_qr, duitnow_payload").eq("id", masjid.id).single(),
    loadFunds(),
    getLogoUrl(masjid.logo_path),
    getTranslations("resit"),
    getTranslations({ locale: "ms", namespace: "resitPdf" }),
    getTranslations({ locale: "ms", namespace: "kewangan" }),
    getLocale(),
  ]);
  const cancelled = !!cancel;
  const fund = funds.find((item) => item.id === entry.fund_id);
  const amount = formatSen(Number(entry.amount_sen));

  // Sharing is for receipts that still stand, by those allowed to share.
  const canShare = can(role, "receipts.share") && !cancelled;
  const secret = canShare ? receiptLinkSecret() : null;
  const shareLink = secret ? `${await appOrigin()}/r/${makeReceiptToken(secret, entry.id)}` : null;
  const whatsapp = shareLink
    ? `https://wa.me/?text=${encodeURIComponent(
        t("whatsappMessage", { masjid: masjid.name, number: entry.receipt_no, amount, link: shareLink, days: RECEIPT_LINK_DAYS }),
      )}`
    : null;

  // The preview is always in Malay, like the PDF it stands for.
  const row = (label: string, value: string) => (
    <div className="flex justify-between gap-4 py-1">
      <dt className="text-muted">{label}</dt>
      <dd className="text-right font-semibold">{value}</dd>
    </div>
  );

  return (
    <>
      <BackLink href={`/kewangan/resit?bulan=${entry.date.slice(0, 7)}`} label={t("title")} />
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-3xl font-bold tracking-tight">{entry.receipt_no}</h1>
        {cancelled ? <Badge tone="warn">{t("cancelledBadge")}</Badge> : null}
      </div>
      {cancelled && cancel ? <p className="mt-2 text-warn-ink">{t("cancelledLead", { date: formatDay(cancel.date, locale) })}</p> : null}

      <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,26rem)_1fr]">
        <article
          lang="ms"
          aria-label={t("preview")}
          className="relative overflow-hidden rounded-panel border border-border bg-surface p-6"
          data-testid="resit-pratonton"
        >
          {cancelled ? (
            <span aria-hidden className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <span className="-rotate-30 text-7xl font-bold text-warn-ink opacity-15">{pdf("cancelled")}</span>
            </span>
          ) : null}
          <header className="flex items-center gap-3 border-b border-rule pb-4">
            <MasjidLogo name={masjid.name} src={logoUrl} className="size-12" />
            <div className="min-w-0">
              <p className="font-bold">{masjid.name}</p>
              <p className="text-sm text-muted">{areaLine(masjid)}</p>
            </div>
          </header>
          <div className="mt-4 flex items-center justify-between gap-2">
            <h2 className="font-bold">{pdf("title")}</h2>
            {cancelled ? <Badge tone="warn">{pdf("cancelled")}</Badge> : null}
          </div>
          <dl className="mt-2 text-sm">
            {row(pdf("number"), entry.receipt_no)}
            {row(pdf("date"), formatDay(entry.date, "ms"))}
            {row(pdf("from"), entry.received_from || "—")}
            {row(pdf("fund"), fund?.name ?? "—")}
            {row(pdf("method"), k(`methods.${entry.method}`))}
          </dl>
          <div className="mt-4 rounded-card bg-background p-4">
            <div className="flex items-end justify-between gap-2">
              <span className="text-sm text-muted">{pdf("total")}</span>
              <span className="text-3xl font-bold tabular-nums">{amount}</span>
            </div>
            <p className="mt-2 text-sm">
              <span className="text-muted">{pdf("inWords")} </span>
              {senInMalayWords(Number(entry.amount_sen))}
            </p>
          </div>
          <p className={`mt-4 text-sm ${cancelled ? "font-semibold text-warn-ink" : "text-muted"}`}>
            {cancelled ? pdf("cancelledNote") : pdf("thanks")}
          </p>
          {settings?.receipt_show_qr && settings.duitnow_payload && !cancelled ? (
            <div className="mt-4 flex flex-col items-end">
              <QrCode text={settings.duitnow_payload} label={pdf("qr")} className="size-24" />
              <p className="mt-1 text-xs text-muted">{pdf("qr")}</p>
            </div>
          ) : null}
          {showsCredit(masjid.plan, settings?.receipt_hide_credit ?? false) ? (
            <p className="mt-6 text-xs text-muted">{pdf("credit")}</p>
          ) : null}
        </article>

        <div className="space-y-6">
          <section aria-labelledby="pdf" className="rounded-card bg-surface p-5">
            <h2 id="pdf" className="text-lg font-bold">
              {t("pdfTitle")}
            </h2>
            <div className="mt-3 flex flex-wrap gap-2">
              <a
                href={`/kewangan/resit/${entry.id}/pdf?muat=1`}
                className="inline-flex min-h-tap items-center gap-2 rounded-chip bg-primary px-4 font-semibold text-surface"
              >
                <Download aria-hidden className="size-4" />
                {t("download")}
              </a>
              <a
                href={`/kewangan/resit/${entry.id}/pdf`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-tap items-center gap-2 rounded-chip border border-border bg-surface px-4 font-semibold text-primary-dark"
              >
                <ExternalLink aria-hidden className="size-4" />
                {t("open")}
              </a>
            </div>
          </section>

          {canShare ? (
            <section aria-labelledby="kongsi" className="rounded-card bg-surface p-5">
              <h2 id="kongsi" className="text-lg font-bold">
                {t("shareTitle")}
              </h2>
              {whatsapp ? (
                <>
                  <p className="mt-1 text-sm text-muted">{t("shareLead", { days: RECEIPT_LINK_DAYS })}</p>
                  <a
                    href={whatsapp}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 inline-flex min-h-tap items-center gap-2 rounded-chip bg-primary px-4 font-semibold text-surface"
                  >
                    <MessageCircle aria-hidden className="size-4" />
                    {t("whatsapp")}
                  </a>
                </>
              ) : (
                <p className="mt-1 text-sm text-muted">{t("shareOff")}</p>
              )}

              <h3 className="mt-6 font-bold">{t("emailTitle")}</h3>
              {emailEnabled() ? <ReceiptEmailForm id={entry.id} /> : <p className="mt-1 text-sm text-muted">{t("emailOff")}</p>}
            </section>
          ) : null}

          <Link href={`/kewangan/${entry.id}`} className="inline-flex min-h-tap items-center font-semibold text-primary-dark underline underline-offset-4">
            {t("openEntry")}
          </Link>
        </div>
      </div>
    </>
  );
}
