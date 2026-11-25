"use server";

import { revalidatePath } from "next/cache";
import { checkLogo, LOGO_BUCKET } from "@/lib/logo";
import { requireMember } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

export type LogoState = { error?: string; done?: "uploaded" | "removed" };

/**
 * Saves a new logo in the masjid's own folder, points the masjid at it, then
 * deletes the old file. Runs as the user, so Storage and table rules apply.
 */
export async function uploadLogo(_: LogoState, form: FormData): Promise<LogoState> {
  const { masjid } = await requireMember("settings.manage");
  const file = form.get("logo");
  if (!(file instanceof File) || file.size === 0) return { error: "logo_empty" };

  const bytes = new Uint8Array(await file.arrayBuffer());
  const check = checkLogo(bytes);
  if (!check.ok) return { error: check.error };

  const supabase = await createClient();
  const path = `masjids/${masjid.id}/logo-${Date.now()}.${check.ext}`;
  const { error: uploadError } = await supabase.storage
    .from(LOGO_BUCKET)
    .upload(path, bytes, { contentType: check.contentType, upsert: false });
  if (uploadError) return { error: "generic" };

  const { error: updateError } = await supabase.from("masjids").update({ logo_path: path }).eq("id", masjid.id);
  if (updateError) {
    await supabase.storage.from(LOGO_BUCKET).remove([path]);
    return { error: "generic" };
  }

  if (masjid.logo_path && masjid.logo_path !== path) {
    await supabase.storage.from(LOGO_BUCKET).remove([masjid.logo_path]);
  }

  revalidatePath("/", "layout");
  return { done: "uploaded" };
}

export async function removeLogo(): Promise<LogoState> {
  const { masjid } = await requireMember("settings.manage");
  if (!masjid.logo_path) return { done: "removed" };

  const supabase = await createClient();
  const { error } = await supabase.from("masjids").update({ logo_path: null }).eq("id", masjid.id);
  if (error) return { error: "generic" };
  await supabase.storage.from(LOGO_BUCKET).remove([masjid.logo_path]);

  revalidatePath("/", "layout");
  return { done: "removed" };
}
