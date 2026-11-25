"use server";

import { redirect } from "next/navigation";
import type { AuthError } from "@supabase/supabase-js";
import { errorKey } from "@/lib/auth-errors";
import { looksLikeEmail, normaliseEmail } from "@/lib/invitations";
import { isState, isZoneInState } from "@/lib/malaysia";
import { appOrigin } from "@/lib/origin";
import { safeNext } from "@/lib/safe-next";
import { getUser, isPlatformAdmin } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

/** What a form shows after a send: a message key under "errors" or a done flag. */
export type FormState = { error?: string; done?: boolean };

const MIN_PASSWORD = 8;

function text(form: FormData, name: string) {
  const value = form.get(name);
  return typeof value === "string" ? value.trim() : "";
}

function authErrorKey(error: AuthError) {
  switch (error.code) {
    case "invalid_credentials":
      return "invalid_credentials";
    case "email_not_confirmed":
      return "email_not_confirmed";
    case "user_already_exists":
    case "email_exists":
      return "email_taken";
    case "weak_password":
      return "weak_password";
    case "over_email_send_rate_limit":
    case "over_request_rate_limit":
      return "rate_limited";
    case "otp_expired":
      return "link_expired";
    default:
      return "generic";
  }
}

export async function signInWithPassword(_: FormState, form: FormData): Promise<FormState> {
  const email = normaliseEmail(text(form, "email"));
  const password = form.get("password");
  if (!looksLikeEmail(email) || typeof password !== "string" || !password) return { error: "missing_fields" };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: authErrorKey(error) };

  redirect(safeNext(form.get("next")));
}

export async function sendMagicLink(_: FormState, form: FormData): Promise<FormState> {
  const email = normaliseEmail(text(form, "email"));
  if (!looksLikeEmail(email)) return { error: "missing_fields" };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    // A magic link signs in existing accounts only. New people use the sign-up page.
    options: { shouldCreateUser: false, emailRedirectTo: `${await appOrigin()}/auth/callback?next=/` },
  });
  // Do not reveal whether an account exists: unknown emails get the same reply.
  if (error && error.status === 429) return { error: "rate_limited" };
  return { done: true };
}

export async function signUp(_: FormState, form: FormData): Promise<FormState> {
  const fullName = text(form, "fullName");
  const email = normaliseEmail(text(form, "email"));
  const password = form.get("password");
  if (!fullName || !looksLikeEmail(email) || typeof password !== "string") return { error: "missing_fields" };
  if (password.length < MIN_PASSWORD) return { error: "weak_password" };

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName },
      emailRedirectTo: `${await appOrigin()}/auth/callback?next=/mula`,
    },
  });
  if (error) return { error: authErrorKey(error) };
  return { done: true };
}

export async function requestPasswordReset(_: FormState, form: FormData): Promise<FormState> {
  const email = normaliseEmail(text(form, "email"));
  if (!looksLikeEmail(email)) return { error: "missing_fields" };

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${await appOrigin()}/auth/callback?next=/tetapkan-kata-laluan`,
  });
  if (error?.code === "over_email_send_rate_limit") return { error: "rate_limited" };
  return { done: true };
}

export async function updatePassword(_: FormState, form: FormData): Promise<FormState> {
  const password = form.get("password");
  const confirm = form.get("confirm");
  if (typeof password !== "string" || password.length < MIN_PASSWORD) return { error: "weak_password" };
  if (password !== confirm) return { error: "password_mismatch" };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: authErrorKey(error) };
  return { done: true };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/log-masuk");
}

export async function createMasjid(_: FormState, form: FormData): Promise<FormState> {
  const user = await getUser();
  if (!user) redirect("/log-masuk");
  if (isPlatformAdmin(user)) return { error: "platform_admin" };

  const name = text(form, "name");
  const state = text(form, "state");
  const address = text(form, "address");
  const zone = text(form, "zone");
  if (!name || !isState(state) || !isZoneInState(state, zone)) return { error: "missing_fields" };

  const supabase = await createClient();
  const { error } = await supabase.rpc("create_masjid", {
    p_name: name,
    p_state: state,
    p_address: address,
    p_prayer_zone: zone,
  });
  if (error) return { error: errorKey(error.message) };

  redirect("/");
}
