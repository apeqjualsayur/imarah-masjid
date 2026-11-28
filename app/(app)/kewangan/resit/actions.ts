"use server";

import { sendReceiptEmail } from "@/lib/receipt-email";
import { requireMember } from "@/lib/session";

export type EmailState = { error?: string; sent?: boolean; n?: number };

/** The "Hantar emel" form on a receipt. Pengerusi and Bendahari only. */
export async function emailReceipt(id: string, prev: EmailState, form: FormData): Promise<EmailState> {
  await requireMember("receipts.share");
  const n = (prev.n ?? 0) + 1;
  const error = await sendReceiptEmail(id, String(form.get("email") ?? ""));
  return error ? { error, n } : { sent: true, n };
}
