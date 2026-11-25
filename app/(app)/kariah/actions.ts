"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { decodeCsv } from "@/lib/csv";
import { ADDRESS_MAX, icLast4, isRelation, isValidBirthDate, NAME_MAX } from "@/lib/kariah";
import { checkImport, IMPORT_MAX_BYTES, type ImportRow } from "@/lib/kariah-import";
import { normalisePhone } from "@/lib/phone";
import { checkPlanLimit } from "@/lib/plan-limits";
import { requireMember } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

export type KariahState = { error?: string; limit?: number };

const text = (form: FormData, name: string) => String(form.get(name) ?? "").trim();
const FOREIGN_KEY_VIOLATION = "23503";

/**
 * Adds or edits a household. Consent dates are kept when the box stays
 * ticked, set to now when newly ticked and cleared when unticked.
 */
export async function saveHousehold(id: string | null, _: KariahState, form: FormData): Promise<KariahState> {
  const { masjid } = await requireMember("kariah.edit");
  const supabase = await createClient();

  const head_name = text(form, "head_name").replace(/\s+/g, " ");
  const address = text(form, "address") || null;
  if (!head_name) return { error: "name_missing" };
  if (head_name.length > NAME_MAX) return { error: "name_too_long" };
  if (address && address.length > ADDRESS_MAX) return { error: "address_too_long" };

  const phone = normalisePhone(text(form, "phone"));
  if (!phone.ok) return { error: phone.error };

  const wantsWhatsapp = form.get("whatsapp") === "on";
  const wantsPdpa = form.get("pdpa") === "on";
  if (wantsWhatsapp && !phone.value?.startsWith("01")) return { error: "whatsapp_needs_mobile" };

  let before: { whatsapp_consent_at: string | null; pdpa_consent_at: string | null } | null = null;
  if (id) {
    const { data } = await supabase
      .from("households")
      .select("whatsapp_consent_at, pdpa_consent_at")
      .eq("id", id)
      .maybeSingle();
    if (!data) return { error: "not_found" };
    before = data;
  } else {
    const limit = await checkPlanLimit(supabase, masjid, "households", 1);
    if (!limit.allowed) return { error: "plan_limit", limit: limit.limit ?? undefined };
  }

  const now = new Date().toISOString();
  const row = {
    head_name,
    address,
    phone: phone.value,
    whatsapp_opt_in: wantsWhatsapp,
    whatsapp_consent_at: wantsWhatsapp ? (before?.whatsapp_consent_at ?? now) : null,
    pdpa_consent_at: wantsPdpa ? (before?.pdpa_consent_at ?? now) : null,
  };

  const query = id
    ? supabase.from("households").update(row).eq("id", id).select("id").single()
    : supabase.from("households").insert(row).select("id").single();
  const { data, error } = await query;
  if (error || !data) return { error: "generic" };

  revalidatePath("/kariah");
  redirect(`/kariah/${data.id}`);
}

export async function deleteHousehold(id: string): Promise<KariahState> {
  await requireMember("kariah.edit");
  const supabase = await createClient();
  const { data, error } = await supabase.from("households").delete().eq("id", id).select("id");
  if (error?.code === FOREIGN_KEY_VIOLATION) return { error: "household_in_use" };
  if (error || !data?.length) return { error: "generic" };

  revalidatePath("/kariah");
  redirect("/kariah");
}

export async function saveMember(
  householdId: string,
  memberId: string | null,
  _: KariahState,
  form: FormData,
): Promise<KariahState> {
  await requireMember("kariah.edit");

  const name = text(form, "name").replace(/\s+/g, " ");
  if (!name) return { error: "name_missing" };
  if (name.length > NAME_MAX) return { error: "name_too_long" };

  const relation = text(form, "relation");
  if (relation && !isRelation(relation)) return { error: "generic" };

  const dob = text(form, "date_of_birth");
  if (dob && !isValidBirthDate(dob, new Date())) return { error: "dob_bad" };

  const ic = icLast4(text(form, "ic_last4"));
  if (!ic.ok) return { error: "ic_bad" };

  const row = { name, relation: relation || null, date_of_birth: dob || null, ic_last4: ic.value };
  const supabase = await createClient();
  const { data, error } = memberId
    ? await supabase.from("members").update(row).eq("id", memberId).eq("household_id", householdId).select("id")
    : await supabase.from("members").insert({ ...row, household_id: householdId }).select("id");
  if (error || !data?.length) return { error: "generic" };

  revalidatePath(`/kariah/${householdId}`);
  redirect(`/kariah/${householdId}`);
}

export async function deleteMember(householdId: string, memberId: string): Promise<KariahState> {
  await requireMember("kariah.edit");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("members")
    .delete()
    .eq("id", memberId)
    .eq("household_id", householdId)
    .select("id");
  if (error || !data?.length) return { error: "generic" };

  revalidatePath(`/kariah/${householdId}`);
  redirect(`/kariah/${householdId}`);
}

// CSV import ---------------------------------------------------------------

export type PreviewState =
  | { stage: "upload"; error?: string }
  | { stage: "preview"; text: string; rows: ImportRow[]; valid: number; invalid: number; room: number | null }
  | { stage: "done"; imported: number; skipped: number; error?: string };

async function existingHouseholds() {
  const supabase = await createClient();
  const { data, error } = await supabase.from("households").select("head_name, address, phone").limit(10_000);
  if (error) throw new Error(error.message);
  return data;
}

/** Reads the uploaded file and checks every row. Saves nothing. */
export async function previewImport(_: PreviewState, form: FormData): Promise<PreviewState> {
  const { masjid } = await requireMember("kariah.edit");
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) return { stage: "upload", error: "csv_empty" };
  if (file.size > IMPORT_MAX_BYTES) return { stage: "upload", error: "csv_too_big" };

  const csvText = decodeCsv(new Uint8Array(await file.arrayBuffer()));
  const check = checkImport(csvText, await existingHouseholds());
  if (!check.ok) return { stage: "upload", error: check.error };

  const supabase = await createClient();
  const limit = await checkPlanLimit(supabase, masjid, "households", check.valid);
  return { stage: "preview", text: csvText, rows: check.rows, valid: check.valid, invalid: check.invalid, room: limit.room };
}

/**
 * Imports the valid rows. Checks the text again from scratch, including
 * duplicates against what is in the registry now.
 */
export async function confirmImport(_: PreviewState, form: FormData): Promise<PreviewState> {
  const { masjid } = await requireMember("kariah.edit");
  const csvText = String(form.get("text") ?? "");
  if (!csvText || csvText.length > IMPORT_MAX_BYTES * 2) return { stage: "upload", error: "csv_empty" };

  const check = checkImport(csvText, await existingHouseholds());
  if (!check.ok) return { stage: "upload", error: check.error };

  const supabase = await createClient();
  const limit = await checkPlanLimit(supabase, masjid, "households", check.valid);
  if (!limit.allowed) return { stage: "upload", error: "plan_limit" };

  const now = new Date().toISOString();
  const rows = check.rows
    .filter((row) => row.errors.length === 0)
    .map((row) => ({
      head_name: row.head_name,
      address: row.address,
      phone: row.phone,
      whatsapp_opt_in: row.whatsapp,
      whatsapp_consent_at: row.whatsapp ? now : null,
      pdpa_consent_at: row.pdpa ? now : null,
    }));

  let imported = 0;
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await supabase.from("households").insert(rows.slice(i, i + 500));
    if (error) {
      revalidatePath("/kariah");
      return { stage: "done", imported, skipped: check.rows.length - imported, error: "import_partial" };
    }
    imported += Math.min(500, rows.length - i);
  }

  revalidatePath("/kariah");
  return { stage: "done", imported, skipped: check.invalid };
}
