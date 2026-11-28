"use server";

import { revalidatePath } from "next/cache";
import { requireMember } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

export type CreditState = { error?: string; saved?: boolean };

/** Hides or shows "Dijana oleh Imarah" on receipts. Has no effect on the Asas plan. */
export async function saveReceiptCredit(_: CreditState, form: FormData): Promise<CreditState> {
  const { masjid } = await requireMember("settings.manage");
  if (masjid.plan === "asas") return { error: "credit_asas" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("masjids")
    .update({ receipt_hide_credit: form.get("hide_credit") === "on" })
    .eq("id", masjid.id);
  if (error) return { error: "generic" };

  revalidatePath("/tetapan/resit");
  return { saved: true };
}
