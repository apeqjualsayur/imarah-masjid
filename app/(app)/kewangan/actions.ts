"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ATTACHMENT_BUCKET, checkAttachment } from "@/lib/attachment";
import { cashbookError, isIsoDate, isMethod, NOTE_MAX, REASON_MAX, RECEIVED_FROM_MAX, REF_MAX, todayInMalaysia } from "@/lib/cashbook";
import { looksLikeEmail, normaliseEmail } from "@/lib/invitations";
import { parseRinggit } from "@/lib/money";
import { can } from "@/lib/permissions";
import { sendReceiptEmail } from "@/lib/receipt-email";
import { requireMember } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

export type EntryValues = {
  direction: string;
  date: string;
  fund_id: string;
  category_id: string;
  amount: string;
  method: string;
  ref_no: string;
  note: string;
  received_from: string;
  email: string;
};

/** `values` puts what was typed back in the form after a refusal. `n` remounts it. */
export type EntryState = { error?: string; values?: EntryValues; n?: number };

const text = (form: FormData, name: string) => String(form.get(name) ?? "").trim();
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function readValues(form: FormData): EntryValues {
  return {
    direction: text(form, "direction"),
    date: text(form, "date"),
    fund_id: text(form, "fund_id"),
    category_id: text(form, "category_id"),
    amount: text(form, "amount"),
    method: text(form, "method"),
    ref_no: text(form, "ref_no"),
    note: text(form, "note"),
    received_from: text(form, "received_from").replace(/\s+/g, " "),
    email: text(form, "email"),
  };
}

/**
 * Checks an attachment the browser uploaded to the masjid's folder: the path
 * must be one the browser could only have made for this masjid, and the bytes
 * must really be a JPG, PNG, WebP or PDF. A bad file is removed.
 */
async function checkUploaded(supabase: Awaited<ReturnType<typeof createClient>>, masjidId: string, path: string) {
  const pattern = new RegExp(`^masjids/${masjidId}/[0-9a-f-]{36}\\.(jpg|png|webp|pdf)$`);
  if (!pattern.test(path)) return "attachment_wrong_type";

  const { data, error } = await supabase.storage.from(ATTACHMENT_BUCKET).download(path);
  if (error || !data) return "attachment_failed";
  const check = checkAttachment(new Uint8Array(await data.arrayBuffer()));
  if (!check.ok || !path.endsWith(`.${check.ext}`)) {
    await supabase.storage.from(ATTACHMENT_BUCKET).remove([path]);
    return check.ok ? "attachment_wrong_type" : check.error;
  }
  return null;
}

/** Records a receipt or payment. Bendahari only; the database checks the same. */
export async function recordTransaction(prev: EntryState, form: FormData): Promise<EntryState> {
  const { masjid } = await requireMember("transactions.record");
  const values = readValues(form);
  const n = (prev.n ?? 0) + 1;
  const refuse = (error: string): EntryState => ({ error, values, n });

  if (values.direction !== "in" && values.direction !== "out") return refuse("direction_missing");
  if (!isIsoDate(values.date)) return refuse("date_bad");
  if (values.date > todayInMalaysia()) return refuse("date_future");
  if (!UUID.test(values.fund_id)) return refuse("fund_missing");
  if (!UUID.test(values.category_id)) return refuse("category_missing");
  const amount = parseRinggit(values.amount);
  if (!amount.ok) return refuse(amount.error);
  if (!isMethod(values.method)) return refuse("method_missing");
  if (values.ref_no.length > REF_MAX) return refuse("ref_too_long");
  if (values.note.length > NOTE_MAX) return refuse("note_too_long");
  // Only receipts have a donor; a payment ignores what may be left in the fields.
  const isReceipt = values.direction === "in";
  if (isReceipt && values.received_from.length > RECEIVED_FROM_MAX) return refuse("received_from_too_long");
  if (isReceipt && values.email && !looksLikeEmail(normaliseEmail(values.email))) return refuse("email_bad");

  const supabase = await createClient();
  const attachment = text(form, "attachment_path") || null;
  if (attachment) {
    const problem = await checkUploaded(supabase, masjid.id, attachment);
    if (problem) return refuse(problem);
  }

  const { data, error } = await supabase
    .from("transactions")
    .insert({
      direction: values.direction,
      date: values.date,
      fund_id: values.fund_id,
      category_id: values.category_id,
      amount_sen: amount.sen,
      method: values.method,
      ref_no: values.ref_no || null,
      note: values.note || null,
      attachment_path: attachment,
      received_from: (isReceipt && values.received_from) || null,
    })
    .select("id")
    .single();

  if (error || !data) {
    // The file never became evidence, so it can go.
    if (attachment) await supabase.storage.from(ATTACHMENT_BUCKET).remove([attachment]);
    return refuse(cashbookError(error));
  }

  // The entry is saved whatever happens to the email; the ledger says if it was not sent.
  let emailed = "";
  if (isReceipt && values.email) emailed = (await sendReceiptEmail(data.id, values.email)) ? "&emel=gagal" : "&emel=ok";

  revalidatePath("/kewangan");
  revalidatePath("/");
  redirect(`/kewangan?bulan=${values.date.slice(0, 7)}&disimpan=${data.id}${emailed}`);
}

export type ReverseState = { error?: string };

/**
 * Cancels an entry with a linked reversing entry dated today, with the same
 * fund, category, amount and method, going the other way. The Bendahari is then
 * taken to a new-entry form filled in from the original, to enter it correctly.
 */
export async function reverseTransaction(id: string, _: ReverseState, form: FormData): Promise<ReverseState> {
  const { role } = await requireMember("transactions.reverse");
  const reason = text(form, "reason").replace(/\s+/g, " ");
  if (!reason) return { error: "reason_missing" };
  if (reason.length > REASON_MAX) return { error: "reason_too_long" };

  const supabase = await createClient();
  const { data: original } = await supabase
    .from("transactions")
    .select("id, fund_id, category_id, amount_sen, direction, method, reverses_id")
    .eq("id", id)
    .maybeSingle();
  if (!original) return { error: "not_found" };
  if (original.reverses_id) return { error: "reverse_reversal" };

  const { error } = await supabase.from("transactions").insert({
    reverses_id: original.id,
    fund_id: original.fund_id,
    category_id: original.category_id,
    amount_sen: original.amount_sen,
    direction: original.direction === "in" ? "out" : "in",
    method: original.method,
    date: todayInMalaysia(),
    reversal_reason: reason,
  });
  if (error) return { error: cashbookError(error) };

  revalidatePath("/kewangan");
  revalidatePath("/");
  redirect(can(role, "transactions.record") ? `/kewangan/baru?dari=${original.id}` : `/kewangan/${original.id}`);
}
