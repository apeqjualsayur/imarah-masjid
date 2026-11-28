import "server-only";
import { getTranslations } from "next-intl/server";
import { emailEnabled, sendEmail } from "@/lib/email";
import { looksLikeEmail, normaliseEmail } from "@/lib/invitations";
import { formatSen } from "@/lib/money";
import { can } from "@/lib/permissions";
import { buildReceiptPdf, receiptFileName } from "@/lib/receipts";
import { getMembership } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

/**
 * Emails one receipt as a PDF, as the signed-in user. The address is used for
 * this send only: it is not saved, and the audit log only notes that the
 * receipt was emailed. Returns an error code, or null when sent.
 */
export async function sendReceiptEmail(id: string, address: string): Promise<string | null> {
  const membership = await getMembership();
  if (!membership || !can(membership.role, "receipts.share")) return "not_allowed";
  if (!emailEnabled()) return "email_off";
  const to = normaliseEmail(address);
  if (!looksLikeEmail(to) || to.length > 254) return "email_bad";

  const supabase = await createClient();
  const { data: cancel } = await supabase.from("transactions").select("id").eq("reverses_id", id).maybeSingle();
  if (cancel) return "receipt_cancelled";

  const built = await buildReceiptPdf(supabase, id);
  if (!built) return "not_found";

  const t = await getTranslations({ locale: "ms", namespace: "resitEmel" });
  const values = { masjid: built.masjidName, number: built.receipt.receipt_no, amount: formatSen(Number(built.receipt.amount_sen)) };
  const sent = await sendEmail({
    to,
    subject: t("subject", values),
    text: t("body", values),
    attachments: [{ filename: receiptFileName(built.receipt.receipt_no), content: built.pdf }],
  });
  if (!sent) return "email_failed";

  await supabase.rpc("log_receipt_emailed", { p_id: id });
  return null;
}
