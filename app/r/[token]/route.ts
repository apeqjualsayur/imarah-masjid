import { getTranslations } from "next-intl/server";
import { readReceiptToken, receiptLinkSecret } from "@/lib/receipt-link";
import { buildReceiptPdf, receiptFileName } from "@/lib/receipts";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * A shared receipt, opened without signing in. Only a link signed by the
 * server and not yet expired works; it reads that one receipt and nothing
 * else. The admin client is needed because the donor has no account.
 */
export async function GET(_: Request, { params }: RouteContext<"/r/[token]">) {
  const { token } = await params;
  const secret = receiptLinkSecret();
  const check = secret ? readReceiptToken(secret, token) : ({ ok: false, reason: "bad" } as const);

  const built = check.ok ? await buildReceiptPdf(createAdminClient(), check.id) : null;
  if (!built) {
    const t = await getTranslations({ locale: "ms", namespace: "resitKongsi" });
    const expired = !check.ok && check.reason === "expired";
    return refusal(t(expired ? "expiredTitle" : "badTitle"), t(expired ? "expiredBody" : "badBody"), expired ? 410 : 404);
  }

  return new Response(new Uint8Array(built.pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${receiptFileName(built.receipt.receipt_no)}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "X-Robots-Tag": "noindex",
      "Referrer-Policy": "no-referrer",
    },
  });
}

const escape = (text: string) => text.replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);

/** A tiny plain page: the donor may be on any phone, without the app. */
function refusal(title: string, body: string, status: number) {
  const html = `<!doctype html><html lang="ms"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${escape(title)}</title></head><body style="font-family:system-ui,sans-serif;max-width:32rem;margin:3rem auto;padding:0 1rem;line-height:1.5"><h1 style="font-size:1.4rem">${escape(title)}</h1><p>${escape(body)}</p></body></html>`;
  return new Response(html, {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex" },
  });
}
