"use server";

import { revalidatePath } from "next/cache";
import { checkDuitNow } from "@/lib/duitnow";
import { requireMember } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

export type DuitNowState = { error?: string; saved?: "qr" | "removed" | "receipt"; n?: number };

const done = (path: string) => {
  revalidatePath(path);
  revalidatePath("/derma");
};

/**
 * Saves the QR's text after checking it again here. The Pengerusi must tick
 * that the account name shown is the masjid's own.
 */
export async function saveDuitNow(prev: DuitNowState, form: FormData): Promise<DuitNowState> {
  const { masjid } = await requireMember("settings.manage");
  const n = (prev.n ?? 0) + 1;
  const check = checkDuitNow(String(form.get("payload") ?? ""));
  if (!check.ok) return { error: check.error, n };
  if (form.get("confirm") !== "on") return { error: "duitnow_confirm", n };

  const supabase = await createClient();
  const { error } = await supabase.from("masjids").update({ duitnow_payload: check.payload }).eq("id", masjid.id);
  if (error) return { error: "generic", n };
  done("/tetapan/duitnow");
  return { saved: "qr", n };
}

/** Takes the QR off: the Terima derma screen and receipts stop showing it. */
export async function removeDuitNow(prev: DuitNowState): Promise<DuitNowState> {
  const { masjid } = await requireMember("settings.manage");
  const supabase = await createClient();
  const { error } = await supabase
    .from("masjids")
    .update({ duitnow_payload: null, receipt_show_qr: false })
    .eq("id", masjid.id);
  if (error) return { error: "generic", n: (prev.n ?? 0) + 1 };
  done("/tetapan/duitnow");
  return { saved: "removed", n: (prev.n ?? 0) + 1 };
}

/** Prints the QR on receipts, or stops. */
export async function saveReceiptQr(prev: DuitNowState, form: FormData): Promise<DuitNowState> {
  const { masjid } = await requireMember("settings.manage");
  const supabase = await createClient();
  const { error } = await supabase
    .from("masjids")
    .update({ receipt_show_qr: form.get("show_qr") === "on" })
    .eq("id", masjid.id)
    .not("duitnow_payload", "is", null);
  if (error) return { error: "generic", n: (prev.n ?? 0) + 1 };
  done("/tetapan/duitnow");
  return { saved: "receipt", n: (prev.n ?? 0) + 1 };
}
