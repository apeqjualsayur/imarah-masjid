import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getTranslations } from "next-intl/server";
import { formatDay } from "@/lib/dates";
import { initials, LOGO_BUCKET } from "@/lib/logo";
import { renderReceiptPdf, type ReceiptData, type ReceiptLabels } from "@/lib/pdf/receipt";

export type ReceiptRecord = {
  id: string;
  masjid_id: string;
  receipt_no: string;
  date: string;
  received_from: string | null;
  fund_id: string;
  amount_sen: number;
  method: string;
};

/** Paid plans may hide the "Dijana oleh Imarah" line; Asas always shows it. */
export const showsCredit = (plan: string, hideCredit: boolean) => plan === "asas" || !hideCredit;

/** "receipt RC-2026-0001.pdf"-style file name, safe for any browser. */
export const receiptFileName = (receiptNo: string) => `resit-${receiptNo}.pdf`;

// SVG logos are drawn to PNG with resvg (WebAssembly, so nothing native to
// install). Loaded once per server.
// Imported at run time, not bundled: the bundler rewrites a line inside the
// package that breaks it. next.config.ts ships the package with the server.
type ResvgModule = typeof import("@resvg/resvg-wasm");
let resvgReady: Promise<ResvgModule> | null = null;
function loadResvg() {
  resvgReady ??= (async () => {
    const resvg: ResvgModule = await import(/* turbopackIgnore: true */ /* webpackIgnore: true */ "@resvg/resvg-wasm");
    await resvg.initWasm(await readFile(path.join(process.cwd(), "node_modules", "@resvg", "resvg-wasm", "index_bg.wasm")));
    return resvg;
  })();
  return resvgReady;
}

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** The logo as PNG bytes, whatever it was uploaded as (PNG or SVG). */
async function logoPng(client: SupabaseClient, logoPath: string | null): Promise<Buffer | null> {
  if (!logoPath) return null;
  try {
    const { data } = await client.storage.from(LOGO_BUCKET).download(logoPath);
    if (!data) return null;
    const bytes = Buffer.from(await data.arrayBuffer());
    if (bytes.subarray(0, 8).equals(PNG_SIGNATURE)) return bytes;

    const { Resvg } = await loadResvg();
    // Uploads were checked for scripts and outside links (lib/logo.ts); resvg loads nothing anyway.
    const png = new Resvg(bytes.toString("utf8"), { fitTo: { mode: "width", value: 256 } }).render().asPng();
    return Buffer.from(png);
  } catch {
    // A logo that cannot be read must not stop the receipt: initials are shown instead.
    return null;
  }
}

/**
 * Builds a receipt's PDF. `client` is the signed-in user's client (row rules
 * apply) or, for a checked share link only, the admin client; either way the
 * masjid is the receipt's own, never one from the browser.
 */
export async function buildReceiptPdf(
  client: SupabaseClient,
  id: string,
): Promise<{ pdf: Buffer; receipt: ReceiptRecord; masjidName: string } | null> {
  const { data: row } = await client
    .from("transactions")
    .select("id, masjid_id, receipt_no, date, received_from, fund_id, amount_sen, method")
    .eq("id", id)
    .not("receipt_no", "is", null)
    .maybeSingle();
  if (!row) return null;
  const receipt = row as ReceiptRecord;

  const [masjidResult, fundResult, cancelResult] = await Promise.all([
    client
      .from("masjids")
      .select("name, address, state, plan, logo_path, receipt_hide_credit")
      .eq("id", receipt.masjid_id)
      .single(),
    client.from("funds").select("name").eq("id", receipt.fund_id).eq("masjid_id", receipt.masjid_id).single(),
    client.from("transactions").select("id").eq("reverses_id", receipt.id).eq("masjid_id", receipt.masjid_id).maybeSingle(),
  ]);
  const masjid = masjidResult.data;
  if (!masjid) return null;

  const [t, k, logo] = await Promise.all([
    getTranslations({ locale: "ms", namespace: "resitPdf" }),
    getTranslations({ locale: "ms", namespace: "kewangan" }),
    logoPng(client, masjid.logo_path),
  ]);

  const data: ReceiptData = {
    masjidName: masjid.name,
    area: masjid.address?.split(/\r?\n|,/)[0]?.trim() || masjid.state || "",
    initials: initials(masjid.name),
    logo,
    receiptNo: receipt.receipt_no,
    date: formatDay(receipt.date, "ms"),
    receivedFrom: receipt.received_from,
    fund: fundResult.data?.name ?? "—",
    method: k(`methods.${receipt.method}`),
    amountSen: Number(receipt.amount_sen),
    cancelled: !!cancelResult.data,
    showCredit: showsCredit(masjid.plan, masjid.receipt_hide_credit),
  };
  const labels: ReceiptLabels = {
    title: t("title"),
    number: t("number"),
    date: t("date"),
    from: t("from"),
    fund: t("fund"),
    method: t("method"),
    total: t("total"),
    inWords: t("inWords"),
    thanks: t("thanks"),
    signature: t("signature"),
    credit: t("credit"),
    cancelled: t("cancelled"),
    cancelledNote: t("cancelledNote"),
  };

  let pdf: Buffer;
  try {
    pdf = await renderReceiptPdf(data, labels);
  } catch (error) {
    // An unusual PNG the PDF library cannot read: the receipt still goes out, with initials.
    if (!data.logo) throw error;
    pdf = await renderReceiptPdf({ ...data, logo: null }, labels);
  }
  return { pdf, receipt, masjidName: masjid.name };
}
