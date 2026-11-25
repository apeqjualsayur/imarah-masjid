"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { errorKey } from "@/lib/auth-errors";
import { looksLikeEmail, normaliseEmail } from "@/lib/invitations";
import { getUser, isPlatformAdmin, requirePlatformAdmin } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

export type AdminState = { error?: string; done?: boolean };
export type EnrolState = { error?: string; factorId?: string; qr?: string; secret?: string };

const PLANS = ["asas", "standard", "pro", "daerah_negeri"];

export async function adminSignIn(_: AdminState, form: FormData): Promise<AdminState> {
  const email = normaliseEmail(String(form.get("email") ?? ""));
  const password = form.get("password");
  if (!looksLikeEmail(email) || typeof password !== "string" || !password) return { error: "missing_fields" };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: "invalid_credentials" };

  // Masjid accounts cannot use this door.
  if (!isPlatformAdmin(data.user)) {
    await supabase.auth.signOut();
    return { error: "not_platform_admin" };
  }

  redirect("/pentadbir/pengesahan");
}

/** First-time setup: makes a new authenticator secret and its QR code. */
export async function startEnrolment(): Promise<EnrolState> {
  const user = await getUser();
  if (!user || !isPlatformAdmin(user)) redirect("/pentadbir/log-masuk");

  const supabase = await createClient();
  // Clear half-finished attempts, so a fresh QR can be made.
  const { data: factors } = await supabase.auth.mfa.listFactors();
  for (const factor of factors?.all ?? []) {
    if (factor.status === "unverified") await supabase.auth.mfa.unenroll({ factorId: factor.id });
  }

  const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: "Imarah" });
  if (error || !data) return { error: "generic" };

  return { factorId: data.id, qr: data.totp.qr_code, secret: data.totp.secret };
}

/** Checks a 6-digit code, for first-time setup and for every sign-in. */
export async function verifyCode(factorId: string, _: AdminState, form: FormData): Promise<AdminState> {
  const user = await getUser();
  if (!user || !isPlatformAdmin(user)) redirect("/pentadbir/log-masuk");

  const code = String(form.get("code") ?? "").replace(/\s/g, "");
  if (!/^\d{6}$/.test(code)) return { error: "bad_code" };

  const supabase = await createClient();
  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code });
  if (error) return { error: "bad_code" };

  redirect("/pentadbir");
}

export async function setPlan(masjidId: string, _: AdminState, form: FormData): Promise<AdminState> {
  await requirePlatformAdmin();
  const plan = String(form.get("plan") ?? "");
  if (!PLANS.includes(plan)) return { error: "generic" };

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_plan", { p_masjid_id: masjidId, p_plan: plan });
  if (error) return { error: errorKey(error.message) };

  revalidatePath("/pentadbir");
  return { done: true };
}

export async function adminSignOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/pentadbir/log-masuk");
}
